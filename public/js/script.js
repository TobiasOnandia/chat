
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

const header = $('header')

header.innerHTML = `
        <h1>Chat Online</h1>
        <button class="add">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-plus"><path d="M0 0h24v24H0z" stroke="none"/><path d="M12 5v14M5 12h14"/></svg>
        </button>
`

$('.formUser').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target
    const formData = new FormData(form)
    const phone = formData.get('phone')


    header.innerHTML = `
        <h1>+54${phone}</h1>
        <button class="add">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-plus"><path d="M0 0h24v24H0z" stroke="none"/><path d="M12 5v14M5 12h14"/></svg>
        </button>
`
})
