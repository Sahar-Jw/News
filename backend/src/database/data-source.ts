import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDbOptions } from './db-options';

/** Used by the TypeORM CLI (migrations) and the seed script. */
export default new DataSource(buildDbOptions(process.env));
