/**
 * Copyright 2022 Dhiego Cassiano Fogaça Barbosa
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import dotenv from 'dotenv';

import { Server } from "midori/app";

import { prisma } from "@core/lib/Prisma.js";

import config from './config.js';
import cron from './cron.js';
import pipeline from './pipeline.js';
import providers from './providers.js';
import ws from './ws.js';

dotenv.config({ override: true });

export const server = new Server({ production: process.env.NODE_ENV?.toUpperCase() === 'PRODUCTION' });

if (!server.production) {
    dotenv.config({ path: './.env.dev' });
}

config(server);
providers(server);
pipeline(server);
cron(server);

const port = parseInt(process.env.PORT || '3000');

await new Promise<void>((resolve, reject) => {
    server.listen(port).on('listening', async () => {
        console.log(`Server is running on port ${port} in ${server.production ? 'production' : 'development'} mode`);
        await prisma.$connect();
        resolve();
    }).on('close', async () => {
        await prisma.$disconnect();
    });
});
