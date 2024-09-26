require('dotenv').config();

const amqp = require('amqplib/callback_api');

// Conectar ao RabbitMQ
amqp.connect(process.env.RABBITMQ_URL, function(error0, connection) {
    if (error0) {
        throw error0;
    }
    // Criar um canal
    connection.createChannel(function(error1, channel) {
        if (error1) {
            throw error1;
        }

        const queue = 'hazardous_meteors'; // Mesma fila usada pelo produtor

        // Declarar a fila
        channel.assertQueue(queue, {
            durable: false
        });

        console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);

        // Consumir mensagens da fila
        channel.consume(queue, function(msg) {
            console.log(" [x] Received %s", msg.content.toString());
        }, {
            noAck: true // Auto-acknowledgment, ou seja, não requer confirmação
        });
    });
});
