import { APIGatewayProxyResult, APIGatewayEvent, APIGatewayProxyEvent } from 'aws-lambda';
import { Book, BookMutation, deleteBook, getBookByFilter, getBooks, isBookKey, saveBook } from '../services/book-service';
import { injectLambdaContext, Logger } from '@aws-lambda-powertools/logger';
import middy from '@middy/core';

const logger = new Logger();

const errorResponse = function(errorMessages: string[]): APIGatewayProxyResult {
    return {
        statusCode: 400,
        body: JSON.stringify({
            errorMessages: errorMessages
        }, undefined, 2)
    }
}

const successResponse = function(body: Book | string | Book[]): APIGatewayProxyResult {
    return {
        statusCode: 200,
        body: JSON.stringify(body, undefined, 2)
    }
}

const rawHandler = async function(request: APIGatewayEvent) : Promise<APIGatewayProxyResult> {
    if (request.path === '/book' || request.path === '/book/') {
        try{
            return await handleBookResourceRequest(request);
        } catch (error) {
            logger.error({message: (error as Error).message});
            if ((error as Error).message.includes('ConditionalCheckFailed')) {
                return errorResponse([`Error handling ${request.httpMethod}, Book with already exists`]);
            }
            return errorResponse([`Error handling ${request.httpMethod} ${request.path} operation with unexpected error`]);
        }
    } else if(request.path.startsWith('/book/') && !request.path.endsWith('/')){
        const isbn = request.pathParameters?.isbn;
        try {
            if (!isbn) throw new Error('isbn is required');
            return await handleBookDetailRequest(request, isbn);
        } catch (error) {
            logger.error({message: (error as Error).message});
            return errorResponse([`Error handling ${request.httpMethod} operation for book ${isbn} with ${error}`]);
        }
    } else {
        return errorResponse([`Operation not supported, remove the trailing slash`]);
    }
}

export const handler = middy(rawHandler)
  .use(injectLambdaContext(logger));





async function handleBookResourceRequest(request: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    switch(request.httpMethod) {
        case 'GET':
            const queryParams = request.queryStringParameters;
            logger.info(`query params: ${queryParams}`)
            if (queryParams) {
                // TODO query names in plural should be singular to avoid confusion
                const validQueryParameters =  Object.keys(queryParams).filter(key => isBookKey(key) && (queryParams[key] && queryParams[key] !== ''))
                if (validQueryParameters.length === 1) {
                    const key =validQueryParameters[0];
                    const value = queryParams[validQueryParameters[0]] as string;
                    const books = await getBookByFilter({key, value})
                    return successResponse(books);
                } else {
                    logger.error(`No valid filter found in query params ${queryParams}`)
                    return errorResponse(['Provided query parameters does not contain accepted query parameters'])
                }
            } else {
                return {
                    statusCode: 200,
                    body: JSON.stringify(await getBooks())
                }
            }
        case 'POST':
            const result = await saveBook((JSON.parse(request.body!)), false);
            if (result === true) {
                return {
                    statusCode: 200,
                    body: 'saved'
                }
            } else {
                return errorResponse(result);
            }
        default:
            return errorResponse([`Method ${request.httpMethod} is not supported for /product`]);
    }
}

async function handleBookDetailRequest(request: APIGatewayProxyEvent, isbn: string): Promise<APIGatewayProxyResult> {
    switch(request.httpMethod) {
        case 'GET':
            const books = await getBookByFilter({key: 'isbn', value: isbn});
            if (books.length === 1) {
                return successResponse(books[0]);
            }
            return errorResponse([`Book with isbn ${isbn} not found`]);
        case 'PUT':
            const bookData: Book = {isbn, ...(JSON.parse(request.body!) as BookMutation)};
            const result = await saveBook(bookData, true);
            if (result === true) {
                return {
                    statusCode: 200,
                    body: `Book with isbn ${isbn} updated`
                }
            } else {
                return errorResponse(result);
            }
        case 'DELETE': {
            const result = await deleteBook(isbn);
            if (result === true) {
                return {
                    statusCode: 200,
                    body: `Book with isbn ${isbn} deleted`
                }
            } else {
                return errorResponse(result);
            }
        }
        default:
            return errorResponse([`Method ${request.httpMethod} is not supported for ${request.path}`])
    }
}

