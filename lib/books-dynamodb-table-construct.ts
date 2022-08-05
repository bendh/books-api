import { RemovalPolicy } from "aws-cdk-lib";
import { Table, AttributeType, BillingMode, ProjectionType } from "aws-cdk-lib/aws-dynamodb";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/*
      Booktable holds three different entities: 
      - Books PK starts with ISBN# followed by isbn number with sortkey METADATA and book fields
      - Country pk starts with COUNTRY# followed by countryname with sortkey ISBN# followed by isbn number and book fields
      - Authors PK starts with AUTHOR# followed by artistname with sortkey ISBN# followed by isbn number and book fields
*/
export class BookTableConstruct extends Construct {
    /** 
     * @param handler Handler to grant readWrite data access to
    */
    constructor(scope: Construct, id: string, handler: IFunction) {
        super(scope, id);

    const bookTable = new Table(this, 'book-table', {
        tableName: 'Book',
        partitionKey: {
          name: 'entityId',
          type: AttributeType.STRING
        },
        sortKey: {
          name: 'sortKey',
          type: AttributeType.STRING
        },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY
      });

    bookTable.grantReadWriteData(handler);
        bookTable.addGlobalSecondaryIndex({
        indexName: 'nameIndex',
        partitionKey: {
            name: 'name',
            type: AttributeType.STRING
        },
        sortKey: {
            name: 'entityId',
            type: AttributeType.STRING
        },
        projectionType: ProjectionType.INCLUDE,
        nonKeyAttributes: ['pages', 'releaseDate']
        });

        bookTable.addGlobalSecondaryIndex({
        indexName: 'numberofPagesIndex',
        partitionKey: {
            name: 'pages',
            type: AttributeType.NUMBER
        },
        sortKey: {
            name: 'entityId',
            type: AttributeType.STRING
        },
        projectionType: ProjectionType.INCLUDE,
        nonKeyAttributes: ['name', 'releaseDate']
        });

        bookTable.addGlobalSecondaryIndex({
        indexName: 'releaseDateIndex',
        partitionKey: {
            name: 'releaseDate',
            type: AttributeType.STRING
        },
        sortKey: {
            name: 'entityId',
            type: AttributeType.STRING
        },
        projectionType: ProjectionType.INCLUDE,
        nonKeyAttributes: ['name', 'pages']
        });

        bookTable.addGlobalSecondaryIndex({
        indexName: 'reverseSortkeyIndex',
        partitionKey: {
            name: 'sortKey',
            type: AttributeType.STRING
        },
        sortKey: {
            name: 'entityId',
            type: AttributeType.STRING
        },
        projectionType: ProjectionType.ALL
        });
    }
}