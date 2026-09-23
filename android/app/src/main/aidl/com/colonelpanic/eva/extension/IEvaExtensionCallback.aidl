package com.colonelpanic.eva.extension;

oneway interface IEvaExtensionCallback {
    void onResult(String requestId, String responseJson);
}
