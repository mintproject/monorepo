export default {
    uuid: "c664d438-218d-418b-bfe1-7a0b08918f84",
    tenant: "portals",
    subscriptionName: "jobs~mosorio~portals~60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007~TSZn",
    eventUuid: "8b57afe8-16ba-4eee-989c-bb71a8759cf7",
    event: {
        source: "https://tapis.io/jobs",
        type: "jobs.JOB_NEW_STATUS.STAGING_INPUTS",
        data: {
            newJobStatus: "STAGING_INPUTS",
            oldJobStatus: "PROCESSING_INPUTS",
            jobName: "bae0f0be6dbee791f1841c20f9903afc",
            jobUuid: "60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007",
            jobOwner: "mosorio",
            message:
                "The job has transitioned to a new status: STAGING_INPUTS. The previous job status was PROCESSING_INPUTS."
        },
        seriesId: "60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007",
        seriesSeqCount: 4,
        timestamp: "2024-06-12T14:03:21.595939893Z",
        deleteSubscriptionsMatchingSubject: false,
        endSeries: false,
        tenant: "portals",
        user: "jobs",
        received: "2024-06-12T14:03:21.615954424Z",
        uuid: "8b57afe8-16ba-4eee-989c-bb71a8759cf7"
    },
    deliveryTarget: {
        deliveryMethod: "WEBHOOK",
        deliveryAddress: "https://webhook.site/dbb05bdc-8f00-4315-8b5b-d16b723cb95d"
    },
    created: "2024-06-12T14:03:21.635255381Z"
};
