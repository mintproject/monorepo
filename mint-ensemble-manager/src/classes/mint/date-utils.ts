export const fromTimestampIntegerToString = (timestamp: number) : string => {
    return new Date(timestamp).toISOString().replace(/\.000Z$/, '');
}

export const fromTimestampIntegerToReadableString = (timestamp: number) : string => {
    return fromTimestampIntegerToString(timestamp).replace(/T/,' at ').replace(/\..+$/,'');
}

export const fromTimestampIntegerToDateString = (timestamp: number) : string => {
    return fromTimestampIntegerToString(timestamp).replace(/T.*$/,'');
}