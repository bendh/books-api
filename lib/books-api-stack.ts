import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import { BookApiConstruct } from './books-api-construct';
import { BookTableConstruct } from './books-dynamodb-table-construct';


export class BooksApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bookApiFunction = new NodejsFunction(this, 'books-api-handler', {
      entry: path.join(__dirname, '../src/functions/books-api-handler.ts'),
      bundling: {
        minify: true,
        sourceMap: true,
        sourcesContent: false,
        externalModules: ['aws-sdk'],
        esbuildArgs: {
          "--analyze":true
        }
      },
      runtime: Runtime.NODEJS_16_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(5),
      memorySize: 512
    });

    new BookTableConstruct(this, 'book-table', bookApiFunction);

    new BookApiConstruct(this, 'book-api', {
      handler: bookApiFunction,
      cognitoUserPoolProps: {
        userPoolName: 'book-user-pool'
      }
    });

}
}