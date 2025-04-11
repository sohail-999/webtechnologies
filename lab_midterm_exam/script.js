// script.js
const viewButtons = document.querySelectorAll('.view-button');
const taskFrame = document.getElementById('taskFrame');

viewButtons.forEach(button => {
    button.addEventListener('click', function() {
        const src = this.getAttribute('data-src');
        taskFrame.src = src;
    });
});