/* eslint-disable no-undef */
'use strict'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { availableParallelism } from 'node:os'
import cluster from 'node:cluster'
import { createAdapter, setupPrimary } from '@socket.io/cluster-adapter'
import https from 'https'
import dotenv from 'dotenv'
dotenv.config()

if (cluster.isPrimary) {
  const numCpus = availableParallelism()

  for (let i = 0; i < numCpus; i++) {
    cluster.fork({
      PORT: 3000 + i
    })
  }

  setupPrimary()
} else {
  const app = express()
  const server = createServer(app)
  const io = new Server(server, {
    connectionStateRecovery: {},
    adapter: createAdapter()
  })

  const ACCESS_TOKEN = process.env.ACCESS_TOKEN
  const VERIFY_TOKEN = 'myTokenAccess'
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID

  // Middleware para manejar JSON
  app.use(express.json())
  app.use(express.static('public'))

  // Conexión a la base de datos
  const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
  })

  // Crear tabla de mensajes si no existe
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT,
      phone_number TEXT
    );
  `)

  const port = process.env.PORT

  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode && token === VERIFY_TOKEN) {
      console.log('Webhook validado correctamente.')
      res.status(200).send(challenge)
    } else {
      console.log('Error de validación del webhook.')
      res.sendStatus(403)
    }
  })

  app.post('/webhook', async (req, res) => {
    const body = req.body;
  
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0]; 
      if (!entry) {
        console.error('No se encontró "entry" en el webhook');
        return res.sendStatus(400);
      }
  
      const changes = entry.changes?.[0];
      if (!changes) {
        console.error('No se encontró "changes" en el webhook');
        return res.sendStatus(400);
      }
  
      const messageData = changes.value?.messages?.[0];
      if (!messageData) {
        console.error('No se encontró "messages" en el webhook');
        return res.sendStatus(200); 
      }
  
      if (messageData.type === 'text') {
        const from = messageData.from; 
        const messageText = messageData.text.body; 
  
        try {
          await db.run(
            `INSERT INTO messages (content, client_offset, phone_number) VALUES (?, ?, ?)`,
            messageText,
            null,
            from
          );
  
          // Envía el mensaje al cliente web
          io.emit('chat message', messageText, from);
        } catch (error) {
          console.error('Error al guardar el mensaje en la base de datos:', error);
        }
      }
  
      // Respuesta de confirmación
      return res.status(200).send('EVENT_RECEIVED');
    }
  
    // Si el evento no es de WhatsApp Business
    res.sendStatus(404);
  });
  

  function sendMessageToWhatsApp(messageText, phoneNumber) {
    const data = JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: {
        body: messageText
      }
    })

    const options = {
      hostname: "graph.facebook.com",
      path: `/v21.0/${PHONE_NUMBER_ID}/messages`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      }
    }

    const req = https.request(options, (res) => {
      let response = ''

      res.on('data', (chunk) => {
        response += chunk
      })

      res.on('end', () => {
        console.log('Mensaje enviado a WhatsApp:', response)
      })
    })

    req.on('error', (error) => {
      console.error('Error al enviar mensaje a WhatsApp:', error)
    })

    req.write(data)
    req.end()
  }

  io.on('connection', async (socket) => {
    console.log("Un usuario se ha conectado")
    socket.on('chat message', async (message, clientOffset, callback, from = 'web', phone) => {
      console.log("Mensaje recibido desde el chat web", message, clientOffset)
      let result
      const phoneNumber = `+54${phone}` 

      try {
        result = await db.run(
          `INSERT INTO messages (content, client_offset, phone_number) VALUES (?, ?, ?)`,
          message,
          clientOffset,
          phoneNumber
        )

        sendMessageToWhatsApp(message, phoneNumber)

        io.emit('chat message', message, result.lastID, from)

        callback()
      } catch (error) {
        if (error.errno === 19) {
          callback()
        } else {
          console.error(error)
        }
      }
    })

    if (!socket.recovered) {
      try {
        await db.each(
          'SELECT id, content FROM messages WHERE id > ?',
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            socket.emit('chat message', row.content, row.id)
          }
        )
      } catch (e) {
        console.error(e)
      }
    }

    socket.on('disconnect', () => {
      console.log('Un usuario se ha desconectado')
    })
  })

  server.listen(port, () => {
    console.log(`El servidor está corriendo en el puerto ${port}`)
  })
}
