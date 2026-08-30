import request from "request";

const cookieJar = request.jar();

function _sendRequest(rq: any, options: any, storeCredentials: boolean) {
    options.jar = cookieJar;
    options.uri = rq.url;
    request(options, function (err: any, resp: any, body: any) {
        if (err) {
            rq.onError(err);
        } else {
            rq.onLoad({
                target: {
                    responseText: body
                }
            });
        }
    });
}

export function getResource(rq: any) {
    const options = {
        method: "GET"
    };
    _sendRequest(rq, options, false);
}

export function postJSONResource(rq: any, data: Object) {
    const headers = {
        "Content-type": "application/json"
    } as any;
    const options = {
        headers: headers,
        method: "POST",
        body: JSON.stringify(data)
    };
    _sendRequest(rq, options, false);
}

export function putJSONResource(rq: any, data: Object) {
    const options = {
        headers: {
            "Content-type": "application/json"
        },
        method: "PUT",
        body: JSON.stringify(data)
    };
    _sendRequest(rq, options, false);
}

export function postFormResource(rq: any, keyvalues: any, storeCredentials: boolean) {
    // Crate form data
    let data = "";
    for (const key in keyvalues) {
        if (data) data += "&";
        data += key + "=" + encodeURIComponent(keyvalues[key]);
    }
    const options = {
        headers: {
            "Content-type": "application/x-www-form-urlencoded"
        },
        method: "POST",
        body: data
    };
    _sendRequest(rq, options, storeCredentials);
}

export function deleteResource(rq: any) {
    const options = {
        headers: {
            "Content-type": "application/x-www-form-urlencoded"
        },
        method: "DELETE"
    };
    _sendRequest(rq, options, false);
}
