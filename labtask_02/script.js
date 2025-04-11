const form = document.getElementById('checkoutForm');
const inputs = form.querySelectorAll('input[required]');
const errorMessages = document.querySelectorAll('.error-message');

form.addEventListener('submit', function(event) {
    if (!validateForm()) {
        event.preventDefault();
    } else {
        alert('Form submitted successfully!');
        form.reset();
        clearErrors();
    }
});

function validateForm() {
    let isValid = true;
    clearErrors();

    inputs.forEach(input => {
        const id = input.id;
        const errorElement = document.getElementById(id + 'Error');

        if (!input.value.trim()) {
            displayError(input, errorElement, 'This field is required.');
            isValid = false;
            return;
        }

        switch (id) {
            case 'fullName':
                if (!/^[A-Za-z\s]+$/.test(input.value)) {
                    displayError(input, errorElement, 'Only alphabets and spaces allowed.');
                    isValid = false;
                }
                break;
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
                    displayError(input, errorElement, 'Invalid email format.');
                    isValid = false;
                }
                break;
            case 'phone':
                if (!/^[0-9]+$/.test(input.value) || input.value.length < 10 || input.value.length > 15) {
                    displayError(input, errorElement, 'Must be digits (10-15).');
                    isValid = false;
                }
                break;
            case 'cardNumber':
                if (!/^[0-9]{16}$/.test(input.value)) {
                    displayError(input, errorElement, 'Must be 16 digits.');
                    isValid = false;
                }
                break;
            case 'expiryDate':
                const selectedDate = new Date(input.value);
                const currentDate = new Date();
                currentDate.setHours(0, 0, 0, 0);
                if (selectedDate <= currentDate) {
                    displayError(input, errorElement, 'Must be a future date.');
                    isValid = false;
                }
                break;
            case 'cvv':
                if (!/^[0-9]{3}$/.test(input.value)) {
                    displayError(input, errorElement, 'Must be 3 digits.');
                    isValid = false;
                }
                break;
        }
    });

    return isValid;
}

function displayError(input, errorElement, message) {
    input.classList.add('invalid');
    errorElement.textContent = message;
}

function clearErrors() {
    inputs.forEach(input => input.classList.remove('invalid'));
    errorMessages.forEach(message => message.textContent = '');
}