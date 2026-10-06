import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ApiKey } from './api-key.entity';
@Injectable()
export class ApiKeyService {
 constructor(@InjectRepository(ApiKey) private readonly repo:Repository<ApiKey>){}
 hash(key:string):string{return createHash('sha256').update(key).digest('hex')}
 async findActive(raw:string):Promise<ApiKey|null>{return this.repo.findOne({where:{keyHash:this.hash(raw),active:true}})}
 async create(input:Pick<ApiKey,'name'|'requestsPerMinute'|'monthlyTokenQuota'|'allowedModels'>):Promise<{key:string;entity:ApiKey}>{const raw=`lgw_${randomBytes(32).toString('base64url')}`;const e=this.repo.create({...input,keyHash:this.hash(raw),prefix:raw.slice(0,12),active:true});return {key:raw,entity:await this.repo.save(e)}}
 async list():Promise<ApiKey[]>{return this.repo.find({order:{createdAt:'DESC'}})}
 async revoke(id:string):Promise<void>{await this.repo.update({id},{active:false,revokedAt:new Date()})}
}