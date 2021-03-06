"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableIterator = void 0;
class TableIterator {
    constructor(pipeline, fetcher) {
        this.config = { pipeline, fetcher };
    }
    // when a promise is returned, all promises are resolved in the batch before processing the next batch
    async forEach(iterator) {
        let index = 0;
        let iteratorPromises = [];
        const executor = this.config.fetcher.execute();
        // eslint-disable-next-line no-labels
        strides: for await (const stride of executor) {
            await Promise.all(iteratorPromises);
            iteratorPromises = [];
            for (const item of stride) {
                const iteratorResponse = iterator(item, index, this.config.pipeline);
                index += 1;
                // TODO: Improve false return as an early-exit mechanism. not clear to user
                if (iteratorResponse === false) {
                    await Promise.all(iteratorPromises);
                    // eslint-disable-next-line no-labels
                    break strides;
                }
                else if (typeof iteratorResponse === "object" && iteratorResponse instanceof Promise) {
                    iteratorPromises.push(iteratorResponse);
                }
            }
        }
        await Promise.all(iteratorPromises);
        return this.config.pipeline;
    }
    async map(iterator) {
        const results = [];
        const executor = this.config.fetcher.execute();
        let index = 0;
        for await (const stride of executor) {
            for (const item of stride) {
                results.push(iterator(item, index));
                index += 1;
            }
        }
        return results;
    }
    all() {
        const result = this.map((i) => i);
        return result;
    }
}
exports.TableIterator = TableIterator;
