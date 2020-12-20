import { BatchFetcher } from "./AbstractFetcher";
import { ScanInput, QueryInput, DocumentClient } from "aws-sdk/clients/dynamodb";

export class QueryFetcher<T> extends BatchFetcher<T> {
  private request: ScanInput | QueryInput;
  private operation: "query" | "scan";
  constructor(
    request: ScanInput | QueryInput,
    client: DocumentClient,
    operation: "query" | "scan",
    batchSize = 100,
    bufferCapacity = 4,
    limit?: number
  ) {
    super(client, bufferCapacity, batchSize, limit);
    this.request = request;
    this.operation = operation;
    this.nextToken = true;
  }

  fetchStrategy(): null | Promise<any> {
    if (this.activeRequests.length > 0 || this.bufferSize > this.bufferCapacity || !this.nextToken) {
      return this.activeRequests[0] || null;
    }

    const promise = this.documentClient[this.operation]({
      ...(this.request.Limit && { Limit: this.request.Limit - this.totalReturned }),
      ...this.request,
      ...(this.nextToken && this.nextToken !== true && { ExclusiveStartKey: this.nextToken }),
    }).promise();

    return promise;
  }

  processResult(data: DocumentClient.ScanOutput | DocumentClient.QueryOutput | void): void {
    this.nextToken = (data && data.LastEvaluatedKey) || null;

    if (data && data.Items) {
      this.totalReturned += data.Items.length;
      this.results.push(...(data.Items as T[]));
    }
  }

  // override since filtering results in inconsistent result set size, base buffer on the items returned last
  // this may give surprising results if the returned list varies considerable, but errs on the side of caution.
  getResultBatch(batchSize: number): T[] {
    const items = super.getResultBatch(batchSize);

    if (items.length) {
      this.bufferSize = (this.results || []).length / (items.length || 1);
    } else if (!this.activeRequests.length) {
      // if we don't have any items to process, and no active requests, buffer size should be zero.
      this.bufferSize = 0;
    }

    return items;
  }
}