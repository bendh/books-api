import { APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import { Book, getBooks, saveBook } from '../services/book-service';
import { injectLambdaContext, Logger } from '@aws-lambda-powertools/logger';
import middy from '@middy/core';

const logger = new Logger();

const errorResponse = function(errorMessage: string): APIGatewayProxyResult {
    return {
        statusCode: 400,
        body: `{"errormessage":${errorMessage}}`
    }
}

const successResponse = function(body: Book | string | Book[]): APIGatewayProxyResult {
    return {
        statusCode: 200,
        body: JSON.stringify(body, undefined, 2)
    }
}

const rawHandler = async function(request: APIGatewayEvent) : Promise<APIGatewayProxyResult> {
    const isbn = request.pathParameters?.isbn;

    if (request.path === '/book' || request.path === '/book/') {
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
                    return {
                        statusCode: 400,
                        body: JSON.stringify(result)
                    }
                }

            default:
                return errorResponse(`Method ${request.httpMethod} is not supported for /product`)
        }
    } else if(request.path.startsWith('/product/') && !request.path.endsWith('/')){
        const isbn = request.pathParameters?.productId;
        try {
            if (!isbn) throw new Error('Product id is required');

            switch(request.httpMethod) {
                case 'GET':
                    return successResponse("To implement get Item");
                case 'PUT':
                    const bookToSave = JSON.parse(request.body!) as Book;
                    return successResponse('To implement update item');
                case 'DELETE': {
                    //const deletedProduct = (await deleteProductBy(productId)).Attributes as Product;
                    //return successResponse(`Product with id ${deletedProduct.productId} deleted`);
                    return successResponse('To implement delete item');
                }
                default:
                    return errorResponse(`Method ${request.httpMethod} is not supported for ${request.path}`)
            }
        } catch (error) {
            return errorResponse(`Error handling ${request.httpMethod} operation for book ${isbn} with ${error}`);
        }
    } else {
        return errorResponse(`Operation not supported, remove the trailing slash`);
    }
}

export const handler = middy(rawHandler)
  .use(injectLambdaContext(logger));





