import {describe,it,expect} from 'vitest'
import {readAuthReturnTo} from './authReturnTo'
describe('retorno ao convite após login',()=>{
 it('preserva a rota interna de revisão e a criação da organização',()=>{
  expect(readAuthReturnTo('/pt-br/access/page/id/requests/request')).toBe('/pt-br/access/page/id/requests/request')
  expect(readAuthReturnTo('/pt-br/organizations/new')).toBe('/pt-br/organizations/new')
 })
 it('rejeita URLs externas, protocolos relativos e barras invertidas',()=>{
  for(const url of ['https://example.com','//example.com','/pt-br/organizations\\example.com','/pt-br/sign-in',null,{}])expect(readAuthReturnTo(url)).toBeUndefined()
 })
})
