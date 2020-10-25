
function requestHandlerBuilder(
    validateRequest, // (req) => Promise<void | Error>
    collection, // string
    findParams, // (req) => Promise<object>
) {
    const handler = async (req, res, next, retries=3) => {
        try {
            if (retries === 0) {
                throw new ServerError('Max retries exceeded');
            }

            await validateRequest(req);

            const query = await findParams(req);

            const data = await db.get(collection).findOne(query);

            if (!data) {
                throw new NotFoundError(`Data not found in collection ${collection}`);
            }

            if (!data.modified) {
                throw new ServerError('The data must have a modified stamp.');
            }

            const result = await sendDataToThreadPool(req, { ...data });

            if (result.error) {
                throw errorFactory(error);
            }

            if (result.success) {
                const updateResult = await db.get(collection)
                    .findOneAndUpdate(
                        { _id: data._id, modified: data.modified },
                        result.success,
                        { replaceOne: true },
                    );

                if (!updateResult.value) {
                    handler(req, res, next, retries - 1);
                } else {
                    res.json({
                        success: true,
                        data: updateResult.value,
                    });
                }
            } else {
                throw new ServerError('Malformed thread response');
            }

        } catch (error) {
            next(error);
        }
    };

    return handler;
}