import { CognitoUserPoolsAuthorizer, LambdaRestApi, AuthorizationType, MethodOptions } from "aws-cdk-lib/aws-apigateway";
import { UserPool, UserPoolProps } from "aws-cdk-lib/aws-cognito";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
/**
 * Properties for the BookApiConstruct.
 */
export interface BookApiConstructProps {
    /**
     * Handler will get all calls (proxy) so also error handling will be needed.
     */
    readonly handler: IFunction,
    readonly cognitoUserPoolProps: UserPoolProps
}

/**
 * Construct containing ApiGateway and Cognito pool configuration 
 * specific for the Book API. GET calls to /book resources including
 * childs are public. Other HTTP methods are protected by a Cognito 
 * user pool.
 */
export class BookApiConstruct extends Construct {
    
    constructor(scope: Construct, id: string, props: BookApiConstructProps) {
        super(scope, id);
        const cognitoUserPool = new UserPool(this, 'book-user-pool', props.cognitoUserPoolProps);
        const bookApiAuthorizer = new CognitoUserPoolsAuthorizer(this, 'books-api-authorizer', {
          cognitoUserPools: [cognitoUserPool]
        });
        const protectedMethodsOptions: MethodOptions = {
          authorizationType: AuthorizationType.COGNITO,
          authorizer: bookApiAuthorizer
        }

        const bookApiGateway = new LambdaRestApi(this, id, {
          handler: props.handler,
          proxy: false
        });
        
        const bookCollectionResource = bookApiGateway.root.addResource('book');
        // Public access for READ actions
        bookCollectionResource.addMethod('GET');
        
        // Authenticated access for Create action
        bookCollectionResource.addMethod('POST', undefined, protectedMethodsOptions);

        const bookItemResource = bookCollectionResource.addResource('{isbn}')
        // Public access for READ action
        bookItemResource.addMethod('GET');
        // Authenticated access for Update and Delete actions
        bookItemResource.addMethod('PUT', undefined, protectedMethodsOptions);
        bookItemResource.addMethod('DELETE', undefined, protectedMethodsOptions);
    }

}