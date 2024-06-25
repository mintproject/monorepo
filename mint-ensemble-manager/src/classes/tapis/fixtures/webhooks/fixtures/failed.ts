export default {
    uuid: "f37c080f-2fd4-4269-a216-f35f0927487c",
    tenant: "portals",
    subscriptionName: "jobs~mosorio~portals~60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007~TSZn",
    eventUuid: "2e975412-8047-45fd-add4-ccf746760dd0",
    event: {
        source: "https://tapis.io/jobs",
        type: "jobs.JOB_NEW_STATUS.FAILED",
        subject: "60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007",
        data: {
            newJobStatus: "FAILED",
            oldJobStatus: "STAGING_INPUTS",
            blockedCount: 0,
            condition: "JOB_TRANSFER_FAILED_OR_CANCELLED",
            remoteJobId: null,
            remoteJobId2: null,
            remoteOutcome: null,
            remoteResultInfo: null,
            remoteQueue: null,
            remoteSubmitted: null,
            remoteStarted: null,
            remoteEnded: null,
            jobName: "bae0f0be6dbee791f1841c20f9903afc",
            jobUuid: "60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007",
            jobOwner: "mosorio",
            message:
                "The job has transitioned to a new status: FAILED. The previous job status was STAGING_INPUTS."
        },
        seriesId: "60cfd7b6-746e-416c-bb8c-3cd8c761ab60-007",
        seriesSeqCount: 7,
        timestamp: "2024-06-12T14:03:27.205293429Z",
        deleteSubscriptionsMatchingSubject: true,
        endSeries: false,
        tenant: "portals",
        user: "jobs",
        received: "2024-06-12T14:03:27.207869347Z",
        uuid: "2e975412-8047-45fd-add4-ccf746760dd0"
    },
    deliveryTarget: {
        deliveryMethod: "WEBHOOK",
        deliveryAddress: "https://webhook.site/dbb05bdc-8f00-4315-8b5b-d16b723cb95d"
    },
    created: "2024-06-12T14:03:27.223678219Z"
};
