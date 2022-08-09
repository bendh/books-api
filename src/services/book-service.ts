import { whereCountry } from "iso-3166-1";
const isIsbn: any = require('is-isbn'); // No typescript def files available
const ISO6391 = require('iso-639-1');
import { DynamoDBDocument, QueryCommandInput, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { DynamoDB, PutRequest } from '@aws-sdk/client-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';

const client = new DynamoDB({});
const marshallOptions = {
    convertClassInstanceToMap: true,
};
const ddbDocClient = DynamoDBDocument.from(client, { marshallOptions });
const logger = new Logger();
export interface Book {
    isbn: string,
    name: string,
    pages: number,
    releaseDate: string,
    authors: Array<string>,
    countries: Array<string>,
    languages: Array<string>
}

export type BookMutation = Omit<Book, 'isbn'>;
export type BookKeys = keyof Book;
export interface BookFilter {
    key: string,
    value: string
}

export const isBookMutation = function(book: Book | BookMutation): book is BookMutation {
    return (book as Book).isbn === undefined;
}

export const isBookKey = (key: string): key is BookKeys => {
    const book: Book = {
        isbn: '',
        name: '',
        pages: 0,
        releaseDate: '',
        authors: [],
        countries: [],
        languages: []
    }
    return Object.keys(book).includes(key);
}

export const isValidBookData = function(data: Book | BookMutation): string[] | boolean {
    const validationErrors: string[] = [];
    if (!isBookMutation(data)){
        const isbn = (data as Book).isbn;
        if (!validIsbn(isbn)) validationErrors.push(`isbn value ${isbn} is invalid`);
    }
    const otherFieldsValidationResult: string[] | boolean = isRemainingDataValid(data);
    if (otherFieldsValidationResult !== true) validationErrors.push(...(otherFieldsValidationResult) as string[]);
    return validationErrors.length == 0? true : validationErrors;
}

export const getBookByFilter = async function(filter: BookFilter): Promise<Book[]> {
    switch(filter.key){
        case "isbn":
            const isbnQuery: QueryCommandInput = {
                TableName: 'Book',
                KeyConditionExpression: "#entityId = :entityId AND #sortKey = :sortKey",
                ExpressionAttributeNames: {
                    "#entityId": 'entityId',
                    "#sortKey": 'sortKey',
                    "#name" : 'name',
                    "#languages": 'languages',
                    "#pages": 'pages',
                    "#releaseDate": 'releaseDate',
                    "#authors": 'authors',
                    "#countries": 'countries'
                },
                ExpressionAttributeValues: {
                    ":entityId": `ISBN#${filter.value}`,
                    ":sortKey" : 'METADATA'
                },
                ProjectionExpression: '#entityId, #name, #pages, #releaseDate, #authors, #countries, #languages'
            };
            const isbnQueryResult = await ddbDocClient.query(isbnQuery);
            return isbnQueryResult.Items?.map( record => {
                return BookRecord.convertToBook(record as BookRecord);
            }) || [];
        case "name":
            return executeStringFieldQuery('nameIndex', filter.value, filter.key);
        case "pages":
            return executeStringFieldQuery('numberofPagesIndex', parseInt(filter.value), filter.key);
        case "releaseDate":
            return executeStringFieldQuery('releaseDateIndex', filter.value, filter.key);
        case "authors":
            return executeCollectionFieldQuery(`AUTHOR#${filter.value}`)
        case "languages":
            return executeCollectionFieldQuery(`LANGUAGE#${filter.value}`)
        case "countries":
            return executeCollectionFieldQuery(`COUNTRY#${filter.value}`)
    }
    throw new Error('Not implemented')
}

export const getBooks = async function(): Promise<Book[]> {
    const queryResult = await ddbDocClient.scan(
        {
            TableName: 'Book',
            FilterExpression : 'sortKey = :value',
            ExpressionAttributeValues : {':value' : "METADATA"},
            Limit: 100
        }
    )
    return queryResult.Items?.map<Book>(item=>itemToBookMapper(item)) || [];
}

export const saveBook = async function(bookData: Book, newBook: boolean): Promise<string[] | true> {
    const validity = isValidBookData(bookData);
    if (validity !== true) return validity as string[];
    const itemsToWrite = mapBookToRecords(bookData);
    const chunkSize = 25;
    const chunksToWrite: (BookRecord | BaseRecord)[][] = splitBookRecordArrayInChunks(chunkSize, itemsToWrite);

    await Promise.all(
        chunksToWrite.map(async (chunk) => {
            const putRequests = chunk.map((record)=>{
                const conditionExpression = {
                    ConditionExpression: `#PK <> :pkv AND #SK <> :skv`,
                                    ExpressionAttributeNames: {
                                        "#PK": "entityId",
                                        "#SK": "sortKey"
                                    },
                                    ExpressionAttributeValues: {
                                        ":pkv": record.entityId,
                                        ":skv": record.sortKey
                                    }
                };
                const condition = newBook? {} : conditionExpression;
                const putRequest = {
                    Put: {
                        Item: record,
                        TableName: 'Book',
                        ...condition
                    }
                };
                return putRequest;
            });
            const writeResult = await ddbDocClient.transactWrite({
                TransactItems: putRequests
            });
            logger.info({message: `write result: ${JSON.stringify(writeResult)}` });
        })
    );
    return true;

}

export const  deleteBook = async function(isbn: string): Promise<string[] | true> {
    const bookToDelete: Book = (await getBookByFilter({key: 'isbn', value: isbn}))[0];
    if(bookToDelete) {
        const recordToDelete = mapBookToRecords(bookToDelete);
        const recordChunks = splitBookRecordArrayInChunks(25, recordToDelete);
        await Promise.all(
            recordChunks.map(async (chunk) => {
                const deleteRequests = chunk.map((record)=>{
                    const putRequest = {
                        Delete: {
                            TableName: 'Book',
                            Key: {
                                "entityId": record.entityId,
                                "sortKey": record.sortKey
                            }
                        }
                    };
                    return putRequest;
                });
                const writeResult = await ddbDocClient.transactWrite({
                    TransactItems: deleteRequests
                });
                logger.info({message: `write result: ${JSON.stringify(writeResult)}` });
            })
        );
        return true;
    } else {
        return [`Book not found with isbn ${isbn}`]
    }
}

function validIsbn(isbn: string): boolean {
    const regex = /-/g
    const strippedIsbn = isbn.replace(regex, '');
    return isIsbn.validate(strippedIsbn);
}

function isRemainingDataValid(data:  Book | BookMutation): boolean | string[] {
    const errors: string[] = [];
    if (data.languages.length === 0) errors.push('No language provided for book');
    if (data.countries.length === 0) errors.push('No country provided for book');
    if (data.pages === 0) errors.push('Book pages should be greather then 0');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.releaseDate)) errors.push('Invalid release date, provide date in ISO 8601 format YYYY-MM-DD')
    data.countries.forEach(countryName=>{
        if (!whereCountry(countryName)) errors.push(`Country name ${countryName} is invalid, please provide a english ISO 3166-1 country name`);
    });
    data.languages.forEach(language=>{
        if (!ISO6391.getCode(language)) errors.push(`Language name ${language} is invalid, please provide a english ISO 639-1 language name`);
    });
    return errors.length === 0?true : errors;
}


function itemToBookMapper(item: Record<string, any>): Book {
    return {
        isbn: ((item.entityId) as string).replace('ISBN#', ''),
        name: item.name,
        pages: item.pages,
        releaseDate: item.releaseDate,
        authors: item.authors,
        languages: item.languages,
        countries: item.countries
    } 
}

function splitBookRecordArrayInChunks(chunkSize: number, arrayToSplit: Array<BaseRecord|BookRecord>): (BookRecord | BaseRecord)[][] {
    const chunksToWrite: (BookRecord | BaseRecord)[][] = [];
    while( arrayToSplit.length !==0) {
        chunksToWrite.push(arrayToSplit.splice(0, chunkSize))
    }
    return chunksToWrite;
}

class BookRecord {
   readonly entityId: string;
   readonly sortKey = 'METADATA';
   readonly name: string;
   readonly pages: number;
   readonly releaseDate: string;
   readonly authors: string[] = [];
   readonly languages: string[] = [];
   readonly countries: string[] = [];

   constructor(book: Book) {
    this.entityId = 'ISBN#' + book.isbn;
    this.name = book.name;
    this.pages = book.pages;
    this.releaseDate = book.releaseDate;
    this.authors = book.authors;
    this.languages = book.languages;
    this.countries = book.countries;
   }

   static convertToBook(bookRecord: BookRecord): Book {
    const isbn = bookRecord.entityId.replace('ISBN#', '');
    return {
        isbn,
        ...(bookRecord as BookMutation)
    }
   }
}

abstract class BaseRecord {
    entityId: string;
    readonly sortKey: string;
    readonly bookData: Book;

    constructor(book: Book) {
        this.sortKey = 'ISBN#' + book.isbn;
        this.bookData = {...book};
    }
}

class CountryRecord extends BaseRecord{

    constructor(book: Book, country: string) {
        super(book);
        this.entityId = 'COUNTRY#' + country;
    }
}

class LanguageRecord extends BaseRecord{

    constructor(book: Book, language: string) {
        super(book);
        this.entityId = 'LANGUAGE#' + language;
    }
}

class AuthorRecord extends BaseRecord{
    constructor(book: Book, author: string) {
        super(book);
        this.entityId = 'AUTHOR#' + author;
    }
}

function mapBookToRecords(book: Book): Array<BaseRecord|BookRecord> {
    const records = [];
    records.push(new BookRecord(book));
    records.push(...book.authors.map<AuthorRecord>(author => new AuthorRecord(book, author)));
    records.push(...book.languages.map<LanguageRecord>(language => new LanguageRecord(book, language)));
    records.push(...book.countries.map<CountryRecord>(country => new CountryRecord(book, country)));
    return records;
}

async function executeStringFieldQuery(indexName: string, queryValue: string | number, PKColumn: string): Promise<Book[]> {
    const query: QueryCommandInput = {
        TableName: 'Book',
        IndexName: indexName,
        KeyConditionExpression: "#PK = :PKValue",
        ExpressionAttributeNames: {
            "#PK": PKColumn,
            "#entityId": 'entityId',
            "#name" : 'name',
            "#languages": 'languages',
            "#pages": 'pages',
            "#releaseDate": 'releaseDate',
            "#authors": 'authors',
            "#countries": 'countries'
        },
        ExpressionAttributeValues: {
            ":PKValue": queryValue
        },
        ProjectionExpression: '#entityId, #name, #pages, #releaseDate, #authors, #countries, #languages'
    };
    const nameQueryResult = await ddbDocClient.query(query);
    return nameQueryResult.Items?.map( record => {
        return BookRecord.convertToBook(record as BookRecord);
    }) || [];
}

async function executeCollectionFieldQuery(entityId: string): Promise<Book[]> {
    const query: QueryCommandInput = {
        TableName: 'Book',
        KeyConditionExpression: "#entityId = :entityId",
        ExpressionAttributeNames: {
            "#entityId": 'entityId',
            "#bookData": 'bookData'
        },
        ExpressionAttributeValues: {
            ":entityId": `${entityId}`
        },
        ProjectionExpression: '#bookData'
    };
    const authorQueryResult = await ddbDocClient.query(query);
    return authorQueryResult.Items?.map( record => {
        return record as Book;
    }) || [];
}
