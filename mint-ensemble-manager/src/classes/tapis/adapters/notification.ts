export interface TapisNotification {
    source: string;
    type: string;
    subject: string;
    seriesId: string;
    seriesSeqCount: number;
    timestamp: string;
    deleteSubscriptionsMatchingSubject: boolean;
    endSeries: boolean;
    tenant: string;
    user: string;
    received: string;
    uuid: string;
}
