import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
@Entity('api_keys')
export class ApiKey {
 @PrimaryGeneratedColumn('uuid') id!:string;
 @Index({unique:true}) @Column({type:'varchar',length:64}) keyHash!:string;
 @Column({type:'varchar',length:16}) prefix!:string;
 @Column({type:'varchar',length:120,nullable:true}) name!:string|null;
 @Column({type:'boolean',default:true}) active!:boolean;
 @Column({type:'int',default:60}) requestsPerMinute!:number;
 @Column({type:'bigint',default:0}) monthlyTokenQuota!:string;
 @Column({type:'jsonb',default:[]}) allowedModels!:string[];
 @CreateDateColumn() createdAt!:Date;
 @Column({type:'timestamp with time zone',nullable:true}) revokedAt!:Date|null;
}