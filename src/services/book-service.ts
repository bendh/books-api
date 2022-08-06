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
    key: BookKeys,
    value: string
}

export const isBookMutation = function(book: Book | BookMutation): book is BookMutation {
    return (book as Book).isbn === undefined;
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

export const getBookByFilter = function(filter: BookFilter): Promise<Book[]> {

    switch(filter.key){
        case "isbn":
            const query: QueryCommandInput = {
                TableName: 'Book',
                
            }
        case "name":
        case "authors":
        case "pages":
        case "releaseDate":
        case "languages":
        case "countries":
    }
    throw new Error('Not implemented')
}

export const getBooks = async function(isbn?: string, bookData?: BookMutation): Promise<Book[]> {
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

export const saveBook = async function(bookData: Book): Promise<string[] | true> {
    const validity = isValidBookData(bookData);
    if (validity !== true) return validity as string[];
    const itemsToWrite = mapBookToRecords(bookData);
    const chunkSize = 25;
    const chunksToWrite: (BookRecord | BaseRecord)[][] = [];
    
    while( itemsToWrite.length !==0) {
        chunksToWrite.push(itemsToWrite.splice(0, chunkSize))
    }

    await Promise.all(
        chunksToWrite.map(async (chunk) => {
            const putRequests = chunk.map((record, recordIndex)=>{
                const putRequest = {
                    Put: {
                        Item: record,
                        TableName: 'Book',
                        ConditionExpression: `#PK <> :pkv AND #SK <> :skv`,
                        ExpressionAttributeNames: {
                            "#PK": "entityId",
                            "#SK": "sortKey"
                        },
                        ExpressionAttributeValues: {
                            ":pkv": record.entityId,
                            ":skv": record.sortKey
                        }
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

export const updateBook = function(isbn: string, bookData: BookMutation): Book {
    throw new Error('Not implemented')
}

export const deleteBook = function(isbn: string): void {
    throw new Error('Not implemented')
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
