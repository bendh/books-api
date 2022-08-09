export interface Book {
    isbn: string;
    name: string;
    pages: number;
    releaseDate: string;
    authors: Array<string>;
    countries: Array<string>;
    languages: Array<string>;
}

export type BookMutation = Omit<Book, 'isbn'>;
export type BookKeys = keyof Book;
export interface BookFilter {
    key: string;
    value: string;
}


export class BookRecord {
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
        };
    }
}
export abstract class BaseRecord {
    entityId: string;
    readonly sortKey: string;
    readonly bookData: Book;

    constructor(book: Book) {
        this.sortKey = 'ISBN#' + book.isbn;
        this.bookData = { ...book };
    }
}
export class CountryRecord extends BaseRecord {

    constructor(book: Book, country: string) {
        super(book);
        this.entityId = 'COUNTRY#' + country;
    }
}
export class LanguageRecord extends BaseRecord {

    constructor(book: Book, language: string) {
        super(book);
        this.entityId = 'LANGUAGE#' + language;
    }
}
export class AuthorRecord extends BaseRecord {
    constructor(book: Book, author: string) {
        super(book);
        this.entityId = 'AUTHOR#' + author;
    }
}