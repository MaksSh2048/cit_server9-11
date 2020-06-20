const { paginateResults } = require('./utils');

const pay = async (cardToken, launches) => {
    try {
        let intent = await stripe.paymentIntents.create({
            amount: 999999999.00 * launches,
            currency: 'usd',
            payment_method: cardToken,
            confirm: true,
            error_on_requires_action: true
        });

        if (intent.status === 'succeeded') return true;
        else return false;
    } catch (e) {
        return false;
    }
}

module.exports = {
    Query: {
        launches: async (_, { pageSize = 20, after }, { dataSources }) => {
            const allLaunches = await dataSources.launchAPI.getAllLaunches();
            allLaunches.reverse();

            const launches = paginateResults({
                after,
                pageSize,
                results: allLaunches,
            });

            return {
                launches,
                cursor: launches.length ? launches[launches.length - 1].cursor : null,
                hasMore: launches.length
                    ? launches[launches.length - 1].cursor !==
                    allLaunches[allLaunches.length - 1].cursor
                    : false,
            };
        },
        launch: (_, { id }, { dataSources }) =>
            dataSources.launchAPI.getLaunchById({ launchId: id }),
        me: async (_, __, { dataSources }) =>
            dataSources.userAPI.findOrCreateUser(),
    },
    Mutation: {
        login: async (_, { email }, { dataSources }) => {
            const user = await dataSources.userAPI.findOrCreateUser({ email });
            if (user) return Buffer.from(email).toString('base64');
        },
        bookTrips: async (_, { launchIds, cardToken }, { dataSources }) => {
            let paymentStatus;
            if (cardToken) {
                const stripe = require('stripe')('sk_test_51GuhkpDj5yJqt2Y1kw5UfpFrcrsCQ24jiw76GlpNIWNKWXjBP22WsDj8yzGMS7PvfJiZ9pQDCadjkOaSdEzMfNiD00XUb9xHpa');
                try {
                    const Intent = await stripe.paymentIntents.create({
                        amount: 1000,
                        currency: 'usd',
                        // Verify your integration in this guide by including this parameter
                        payment_method: cardToken,
                        confirm: true,
                        error_on_requires_action: true
                    });
                    paymentStatus = Intent.status;
                } catch (e) {
                    throw new Error(e)
                }
            }
            const results = await dataSources.userAPI.bookTrips({ launchIds });
            const launches = await dataSources.launchAPI.getLaunchesByIds({
                launchIds,
            });

            return {
                success: results && results.length === launchIds.length,
                message:
                    results.length === launchIds.length
                        ? 'trips booked successfully'
                        : `the following launches couldn't be booked: ${launchIds.filter(
                            id => !results.includes(id),
                        )}`,
                launches,
                paymentStatus,
            };
        },
        cancelTrip: async (_, { launchId }, { dataSources }) => {
            const result = await dataSources.userAPI.cancelTrip({ launchId });

            if (!result)
                return {
                    success: false,
                    message: 'failed to cancel trip',
                };

            const launch = await dataSources.launchAPI.getLaunchById({ launchId });
            return {
                success: true,
                message: 'trip cancelled',
                launches: [launch],
            };
        },
    },
    Launch: {
        isBooked: async (launch, _, { dataSources }) =>
            dataSources.userAPI.isBookedOnLaunch({ launchId: launch.id }),
    },
    Mission: {
        missionPatch: (mission, { size } = { size: 'LARGE' }) => {
            return size === 'SMALL'
                ? mission.missionPatchSmall
                : mission.missionPatchLarge;
        },
    },
    User: {
        trips: async (_, __, { dataSources }) => {
            const launchIds = await dataSources.userAPI.getLaunchIdsByUser();

            if (!launchIds.length) return [];

            return (
                dataSources.launchAPI.getLaunchesByIds({
                    launchIds,
                }) || []
            );
        },
    },
};