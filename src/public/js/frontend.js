(async ($) => {

    const $main = $('#main')
    const $btnSync = $('button[name="btnSync"]')

    $btnSync.on('click', function(e){
        $main.attr('data-pending', 'true');

    })

})(jQuery)