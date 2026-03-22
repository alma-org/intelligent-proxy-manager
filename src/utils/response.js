function ok(res, data) {
    return res.status(200).json({ status: 'ok', ...( data !== undefined && { data }) });
}

function created(res, data) {
    return res.status(201).json({ status: 'created', ...(data !== undefined && { data }) });
}

function badRequest(res, message) {
    return res.status(400).json({ status: 'error', message });
}

function serverError(res, err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: err.message });
}

module.exports = { ok, created, badRequest, serverError };
