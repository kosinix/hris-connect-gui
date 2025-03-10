(async ($) => {

    const $main = $('#main')
    const $btnSync = $('button[name="btnSync"]')

    

})(jQuery)

// This is assigned a callback function from preload.js
window.electronAPI.onDataFromBackend((value) => {
    console.log(value)
})