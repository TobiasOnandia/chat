
let counter = 0
const socket = io({
    auth: {
        serverOffset: 0
    },
    ackTimeout: 10000,
    retries:3
})
const $ = (selector) => document.querySelector(selector)

const form = $('form')
const input = $('#sendMessage')
const messages = $('#messages')

form.addEventListener('submit', (e) => {
    e.preventDefault()
    if(input.value){
        const clientOffset = `${socket.id}-${counter++}`
        socket.emit('chat message', input.value, clientOffset)
        input.value = ''
    }
})

socket.on('chat message', (message, serverOffset, from) => {
    console.log("Mensaje recibido desde whatsapp",message)
    const messageElement = document.createElement('li')
    messageElement.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-user"><path d="M0 0h24v24H0z" stroke="none"/><path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
    <span>${message}</span>
    `
    
    if(from === 'web'){
        messageElement.classList.add('message', 'web')
    } else {
        messageElement.classList.add('message', 'whatsapp')
    }

    messages.appendChild(messageElement)
    window.scrollTo(0, document.body.scrollHeight)
    socket.auth.serverOffset = serverOffset
})


const searchInput = $('#search');
const userList = $('#users');

searchInput.addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase();
    const users = userList.querySelectorAll('li');

    users.forEach(user => {
        const userName = user.querySelector('h3').textContent.toLowerCase();
        const userMessage = user.querySelector('p').textContent.toLowerCase();

        if (userName.includes(filter) || userMessage.includes(filter)) {
            user.style.display = 'block';
        } else {
            user.style.display = 'none';
        }
    });
});


const searchMessage = $('#searchMessages');
const messagesList = $('#messages');

searchMessage.addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase();
    const messages = messagesList.querySelectorAll('li');

    messages.forEach(message => {
        const messageText = message.querySelector('span').textContent.toLowerCase();

        if (messageText.includes(filter)) {
            message.style.display = 'flex';
        } else {
            message.style.display = 'none';
        }
    });
});

const openDialog = $('.openDialog');
const closeDialog = $('.closeDialog');
const dialog = $('.dialog');

openDialog.addEventListener('click', () => {
    dialog.showModal();
});

closeDialog.addEventListener('click', () => {
    dialog.close();
});


const formUser = $('.formUser');
const users = $('#users');

formUser.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    const user = formData.get('user');
    const phoneNumber = formData.get('phoneNumber');
    const email = formData.get('email');
    
    if(user && phoneNumber && email){
        const userElement = document.createElement('li');
        userElement.innerHTML = `
             <h3>${user}</h3>
             <p></p>
        `;

        users.appendChild(userElement);

    }   

});