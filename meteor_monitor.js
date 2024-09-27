require('dotenv').config();
const axios = require('axios');
const amqp = require('amqplib/callback_api');

// Obter a chave da API do arquivo .env
const NASA_API_KEY = process.env.NASA_API_KEY;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

// Função para obter os dados dos meteoritos da API da NASA
async function getHazardousAsteroids() {
    const url = `https://api.nasa.gov/neo/rest/v1/feed?api_key=${NASA_API_KEY}`;
    
    try {
        const response = await axios.get(url);
        const nearEarthObjects = response.data.near_earth_objects;

        let hazardousAsteroids = [];

        // Verifica cada objeto em potencial por data
        for (const date in nearEarthObjects) {
            const asteroids = nearEarthObjects[date];

            // Filtra apenas os meteoritos potencialmente perigosos
            asteroids.forEach((asteroid) => {
                if (asteroid.is_potentially_hazardous_asteroid) {
                    hazardousAsteroids.push({
                        name: asteroid.name,
                        size: asteroid.estimated_diameter.kilometers.estimated_diameter_max,
                        approach_date: asteroid.close_approach_data[0].close_approach_date,
                        miss_distance: parseFloat(asteroid.close_approach_data[0].miss_distance.kilometers), // Convertendo para float
                        velocity: asteroid.close_approach_data[0].relative_velocity.kilometers_per_hour,
                    });
                }
            });
        }

        return hazardousAsteroids;

    } catch (error) {
        console.error("Erro ao obter dados da API da NASA:", error.message);
        return [];
    }
}

// Função para publicar mensagens no RabbitMQ
function publishToRabbitMQ(message) {
    amqp.connect(RABBITMQ_URL, function(error0, connection) {
        if (error0) {
            throw error0;
        }

        // Cria o canal
        connection.createChannel(function(error1, channel) {
            if (error1) {
                throw error1;
            }

            const queue = 'hazardous_meteors';

            // Assegura que a fila existe
            channel.assertQueue(queue, { durable: false });

            // Publica a mensagem na fila
            channel.sendToQueue(queue, Buffer.from(message));
            console.log(" [x] Sent '%s'", message);
        });

        // Fecha a conexão depois de um tempo
        setTimeout(function() {
            connection.close();
        }, 500);
    });
}

// Função principal que busca meteoritos perigosos e publica no RabbitMQ
async function monitorAsteroids() {
    console.log("Buscando meteoritos perigosos...");

    const hazardousAsteroids = await getHazardousAsteroids();

    if (hazardousAsteroids.length > 0) {
        // Encontrar o asteroide com a menor miss_distance
        const closestAsteroid = hazardousAsteroids.reduce((prev, curr) => {
            return (prev.miss_distance < curr.miss_distance) ? prev : curr;
        });

        const message = JSON.stringify(closestAsteroid);
        publishToRabbitMQ(message);  // Publica a mensagem no RabbitMQ
        console.log("Asteroide mais próximo:", closestAsteroid);
    } else {
        console.log("Nenhum meteorito perigoso encontrado.");
    }
}

// Executa o monitoramento a cada 1 hora (3600000 ms)
setInterval(monitorAsteroids, 10000);

// Executa pela primeira vez ao iniciar o script
monitorAsteroids();
