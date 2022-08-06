import { APIGatewayProxyResult, APIGatewayEvent, APIGatewayProxyEvent } from 'aws-lambda';
import { Book, getBooks, saveBook } from '../services/book-service';
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
            return errorResponse([`Error handling ${request.httpMethod} ${request.path} operation with unexpected error`]);
        }
    } else if(request.path.startsWith('/product/') && !request.path.endsWith('/')){
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
            return {
                statusCode: 200,
                body: JSON.stringify(await getBooks())
            }
        case 'POST':
            const result = await saveBook(JSON.parse(request.body || ''))
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
            return successResponse("To implement get Item");
        case 'PUT':
            const bookToSave = JSON.parse(request.body!) as Book;
            return successResponse('To implement update item');
        case 'DELETE': {
            return successResponse('To implement delete item');
        }
        default:
            return errorResponse([`Method ${request.httpMethod} is not supported for ${request.path}`])
    }
}

