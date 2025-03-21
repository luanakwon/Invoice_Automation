const session_storage_key = "missing_html";
function parseHeadandBodyfromHTML(htmlContent){
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const headContent = doc.head.innerHTML;
    const bodyContent = doc.body.innerHTML;

    return { headContent, bodyContent };
}
chrome.storage.session.get(session_storage_key).then((result)=>{
    const content = parseHeadandBodyfromHTML(result[session_storage_key]);
    document.querySelector("head").innerHTML = content.headContent;
    document.querySelector("body div").innerHTML = content.bodyContent;
});