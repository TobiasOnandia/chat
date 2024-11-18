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
import https from 'https';


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



  function sendMessageToWhatsApp() {

    const data = JSON.stringify({
      messaging_product: "whatsapp",
      to: "542954526316", // Número del destinatario
      type: "template",
      template: {
        name: "confirmacion_de_turno_reservado",
        language: {
          code: "es",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Juan Pérez" }, // {{1}} - Nombre del destinatario
              { type: "text", text: "Juan Pérez" }, // {{2}} - Nombre del paciente
              { type: "text", text: "Dr. Fernández" }, // {{3}} - Doctor asignado
              { type: "text", text: "2023-11-20" }, // {{4}} - Fecha del turno
              { type: "text", text: "13:00" }, // {{5}} - Hora del turno
              { type: "text", text: "Av. Central, 123" }, // {{6}} - Sede
              { type: "text", text: "Por favor, llegar con el DNI" }, // {{7}} - Notas adicionales
            ],
          },
        ],
      },
    });

    const options = {
      hostname: "graph.facebook.com",
      path: "/v21.0/444271245440118/messages",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let response = '';

      res.on('data', (chunk) => {
        response += chunk;
      });

      res.on('end', () => {
        console.log('Response:', response);
      });
    });

    req.on('error', (error) => {
      console.error('Error:', error);
    });

    req.write(data);
    req.end();


  }

  // Conectarse a la base de datos
  const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
  });


  // Crear la tabla de mensajes si no existe
  await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
  );
`)



  const port = process.env.PORT

  app.use(express.static('public'))

  app.get('/', (req, res) => {
    res.send('Hello World!')
  })

  io.on('connection', async (socket) => {
    console.log('Un usuario se ha conectado')


    socket.on('chat message', async (message, clientOffset, callback) => {
      let result;

      try {
        // Insertar el mensaje en la base de datos
        result = await db.run(`INSERT INTO messages (content, client_offset) VALUES (?, ?)`, message, clientOffset);
      } catch (error) {
        if (error.errno === 19) {
          callback()
        } else {
          console.error(error)
        }

        return
      }

      io.emit('chat message', message, result.lastID)

      callback()
    })

    if (!socket.recovered) {
      try {
        await db.each('SELECT id, content FROM messages WHERE id > ?',
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            socket.emit('chat message', row.content, row.id);
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

  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Tu token de verificación, debe coincidir con el configurado en Meta
    const VERIFY_TOKEN = 'myTokenAccess';

    // Comprueba que el token coincida
    if (mode && token === VERIFY_TOKEN) {
      console.log('Webhook validado correctamente.');
      res.status(200).send(challenge); // Responde con el valor del challenge
    } else {
      console.log('Error de validación del webhook.');
      res.sendStatus(403); // No autorizado
    }
  });

  app.post('/webhook', (req, res) => {
    const body = req.body;
    console.log('Evento recibido:', body);

    // Envía una respuesta de éxito
    res.status(200).send('EVENT_RECEIVED');
  });



  server.listen(port, () => {
    console.log(`El servidor está corriendo en el puerto ${port}`)
  })

}




