const locations = {
    {{LOCATIONS}}
}

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;

    if(request.uri.substring(1) in locations) {
        callback(null, request);
        return
    }

    if (request.uri === "/") {
        request.uri = "/{{root_object}}";
    }

    if (request.uri.endsWith("/")) {
        const redirectResponse = {
            status: '301',
            statusDescription: 'Moved Permanently',
            headers: {
                'location': [{
                    key: 'Location',
                    value: request.uri.substring(0, request.uri.length - 1),
                }],
                'cache-control': [{
                    key: 'Cache-Control',
                    value: "max-age=3600"
                }],
            },
        };
        callback(null, redirectResponse)
        return
    }

    if (!request.uri.endsWith(".html")) {
        (() => {
            //receiving something like /docs

            let toFind = request.uri.substring(1)
            if (toFind in locations) {
                return
            }

            // trying file "docs.html"
            toFind += ".html"
            if (toFind in locations) {
                request.uri = "/" + toFind
                return
            }

            // trying file "docs/index.html"
            toFind = toFind.substring(0, toFind.length - ".html".length)
            toFind += "/index.html"
            if (toFind in locations) {
                request.uri = "/" + toFind
                return
            }
            console.log("not found for object request: '" + request.uri + "'")
        })()
    }

    callback(null, request);
};