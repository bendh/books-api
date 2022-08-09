import { isBookKey, isBookMutation, isValidBookData } from "../../src/services/book-service";
import { Book, BookMutation } from "../../src/services/models";

describe('Book validation test suite', ()=>{
    test('Book mutation is of type BookMutation', ()=>{
        const bookMutation = {
            name: 'test mut',
            authors: ['Me;<)'],
            pages: 1,
            releaseDate: '01-01-2020',
            countries: ['Netherlands'],
            languages: ['Dutch']
        };

        expect(isBookMutation(bookMutation)).toBeTruthy();
    });

    test('Book is not of type BookMutation', ()=>{
        const book = {
            isbn: '123-123-1234',
            name: 'test mut',
            authors: ['Me;<)'],
            pages: 1,
            releaseDate: '01-01-2020',
            countries: ['Netherlands'],
            languages: ['Dutch']
        };

        expect(isBookMutation(book)).toBeFalsy();
    });

    test('Valid book key is asserted as valid bookKeys',()=> {
        const validBookKey = 'isbn'
        expect(isBookKey(validBookKey)).toBeTruthy();
    });

    test('Invalid book key is asserted as invalid bookKeys',()=> {
        const invalidKey = 'foo'
        expect(isBookKey(invalidKey)).toBeFalsy();
    });

    test('book validation succeed with a valid 10 isbn', ()=>{
        expect(isValidBookData(testBook())).toEqual(true);
    });

    test('book validation succeed with a valid 13 isbn', ()=>{
        const isbn = '978-1118-9074-43';
        const validBook = testBook({isbn});
        expect(isValidBookData(validBook)).toEqual(true);
    });

    test('Book with 0 pages returns a error message', ()=>{
        const invalidBook = testBook({pages: 0});
        expect(isValidBookData(invalidBook)).toContainEqual('Book pages should be greather then 0');
    });

    test('Book with no language returns a error message', ()=>{
        const invalidBook = testBook({languages: []});
        expect(isValidBookData(invalidBook)).toContainEqual('No language provided for book');
    });

    test('Book with no country returns a error message', ()=>{
        const invalidBook = testBook({countries: []});
        expect(isValidBookData(invalidBook)).toContainEqual('No country provided for book');
    });

    test('book validation with a invalid isbn returns a isbn error message', ()=>{
        const invalidBook = testBook({isbn: '123-123-1234-23456ASDF'});
        expect(isValidBookData(invalidBook)).toContainEqual(`isbn value ${invalidBook.isbn} is invalid`)
    });

    test('book validation with a invalid country returns a country error message', ()=>{
        const invalidBook = testBook({countries:['foo']});
        expect(isValidBookData(invalidBook)).toContainEqual(`Country name ${invalidBook.countries[0]} is invalid, please provide a english ISO 3166-1 country name`)
    });

    test('book validation with a invalid and a valid country returns a country error message', ()=>{
        const invalidBook = testBook({countries:['foo', 'Belgium']});
        expect(isValidBookData(invalidBook)).toContainEqual(`Country name ${invalidBook.countries[0]} is invalid, please provide a english ISO 3166-1 country name`)
    });

    test('book validation with a invalid language returns a language error message', ()=>{
        const invalidBook = testBook({languages:['Dutch', 'Javascript']});
        expect(isValidBookData(invalidBook)).toContainEqual(`Language name ${invalidBook.languages[1]} is invalid, please provide a english ISO 639-1 language name`)
    });

    test('when multiple errors on a book mutation all errors should be returned', ()=>{
        const invalidBookMutation = testBookMutation({languages:[], pages:0, releaseDate:''});
        expect(isValidBookData(invalidBookMutation)).toContainEqual('No language provided for book');
        expect(isValidBookData(invalidBookMutation)).toContainEqual('Book pages should be greather then 0');
        expect(isValidBookData(invalidBookMutation)).toContainEqual('Invalid release date, provide date in ISO 8601 format YYYY-MM-DD');
        expect(isValidBookData(invalidBookMutation)).toHaveLength(3);
    });

});

// TODO add integration tests with mocked Dynamodb client

const testBookMutation = function(withValues: Partial<BookMutation>): BookMutation {
    const validTestBookMutation = {
        name: 'test mut',
        authors: ['Me;<)'],
        pages: 1,
        releaseDate: '2020-01-10',
        countries: ['Netherlands', 'Belgium'],
        languages: ['Dutch']
    };
    return {...validTestBookMutation, ...withValues};
}

const testBook = function(withValues: Partial<Book> = {}): Book {
    const validTestBook = {
        isbn: '3-932949-11-0',
        name: 'test mut',
        authors: ['Me;<)'],
        pages: 1,
        releaseDate: '1000-12-02',
        countries: ['Netherlands'],
        languages: ['Dutch', 'English']
    };
    return {...validTestBook, ...withValues};
}