"use strict";var y=Object.defineProperty;var O=Object.getOwnPropertyDescriptor;var _=Object.getOwnPropertyNames;var G=Object.prototype.hasOwnProperty;var q=(t,e,r)=>e in t?y(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r;var D=(t,e)=>{for(var r in e)y(t,r,{get:e[r],enumerable:!0})},j=(t,e,r,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of _(e))!G.call(t,o)&&o!==r&&y(t,o,{get:()=>e[o],enumerable:!(i=O(e,o))||i.enumerable});return t};var N=t=>j(y({},"__esModule",{value:!0}),t);var p=(t,e,r)=>q(t,typeof e!="symbol"?e+"":e,r);var B={};D(B,{handler:()=>k});module.exports=N(B);var n=class extends Error{constructor(r,i,o){super(i);p(this,"statusCode");p(this,"service");p(this,"code");p(this,"retryable");this.name="HttpError",this.statusCode=r,this.service=o.service,this.code=o.code,this.retryable=o.retryable??!1}};function m(t,e,r){return e instanceof n?{message:e.message,service:e.service||t,code:e.code||r,retryable:e.retryable}:{message:e instanceof Error?e.message:"Unexpected error",service:t,code:r,retryable:!0}}function w(t,e=500){return t instanceof n?t.statusCode:e}var E={"access-control-allow-origin":"*","access-control-allow-headers":"content-type,authorization","content-type":"application/json"};function b(t){return{statusCode:200,headers:E,body:JSON.stringify(t)}}function h(t,e){return{statusCode:t,headers:E,body:JSON.stringify(e)}}function x(t,e,r){if(!t.body)throw new n(400,"Request body is required",{service:e,code:r,retryable:!1});let i=t.isBase64Encoded?Buffer.from(t.body,"base64").toString("utf8"):t.body;try{return JSON.parse(i)}catch{throw new n(400,"Request body must be valid JSON",{service:e,code:r,retryable:!1})}}function F(t){return t instanceof Error?{name:t.name,message:t.message,stack:t.stack}:{value:String(t)}}function U(t,e={}){console.info(JSON.stringify({level:"info",message:t,...e}))}function C(t,e,r={}){console.error(JSON.stringify({level:"error",message:t,error:F(e),...r}))}function S(t){let e=process.env[t]?.trim();if(!e)throw new Error(`Missing required environment variable: ${t}`);return e}function A(t){if(typeof t=="number")return t;let e=t.match(/\/(\d+)(?:\?.*)?$/);if(!e)throw new Error(`Unable to parse Shopify product ID from "${t}".`);return Number(e[1])}async function $(t,e){let r=S("SHOPIFY_STORE_DOMAIN"),i=S("SHOPIFY_ACCESS_TOKEN"),o=await fetch(`https://${r}/admin/api/2024-04/graphql.json`,{method:"POST",headers:{"X-Shopify-Access-Token":i,"Content-Type":"application/json"},body:JSON.stringify({query:t,variables:e})}),a=await o.json().catch(()=>({}));if(!o.ok)throw new n(o.status,"Shopify GraphQL request failed.",{service:"shopify",code:"SHOPIFY_GRAPHQL_HTTP_ERROR",retryable:o.status>=500});let f=a.errors??[];if(f.length>0){let c=f.map(g=>g.message?.trim()).filter(Boolean).join("; ");throw new n(502,c||"Shopify GraphQL request failed.",{service:"shopify",code:"SHOPIFY_GRAPHQL_ERROR",retryable:!1})}if(!a.data)throw new n(502,"Shopify GraphQL request returned no data.",{service:"shopify",code:"SHOPIFY_GRAPHQL_EMPTY_DATA",retryable:!1});return a.data}async function V(t){let e=await $(`mutation ProductSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers, $synchronous: Boolean) {
      productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
        product {
          id
          title
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,t),r=e.productSet.userErrors??[];if(r.length>0){let o=r.map(a=>a.message?.trim()).filter(Boolean).join("; ");throw new Error(o||"Shopify rejected the unified product mutation.")}let i=e.productSet.product;if(!i?.id)throw new Error("Shopify product mutation returned no product ID.");return{id:A(i.id),adminGraphqlApiId:i.id,title:i.title,status:i.status}}async function R(t,e){if(!t.identifier?.id)throw new Error("Single-mutation collection update requires an existing Shopify product ID identifier.");let r=Array.from(new Set(e.map(s=>s.trim()).filter(s=>/^gid:\/\/shopify\/Collection\/\d+$/i.test(s))));if(r.length===0)return{product:await V(t),collectionFailures:[]};let i=["$input: ProductSetInput!","$identifier: ProductSetIdentifiers!","$synchronous: Boolean","$productIds: [ID!]!"],o=[`productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
      product {
        id
        title
        status
      }
      userErrors {
        field
        message
      }
    }`],a={input:t.input,identifier:t.identifier,synchronous:t.synchronous,productIds:[t.identifier.id]};r.forEach((s,u)=>{let l=`collectionId${u}`;i.push(`$${l}: ID!`),o.push(`collectionJoin${u}: collectionAddProducts(id: $${l}, productIds: $productIds) {
        userErrors {
          field
          message
        }
      }`),a[l]=s});let f=`mutation UpsertProductAndJoinCollections(${i.join(", ")}) {
    ${o.join(`
`)}
  }`,c=await $(f,a),g=c.productSet.userErrors??[];if(g.length>0){let s=g.map(u=>u.message?.trim()).filter(Boolean).join("; ");throw new Error(s||"Shopify rejected the unified product mutation.")}let d=c.productSet.product;if(!d?.id)throw new Error("Shopify product mutation returned no product ID.");let P=[];return r.forEach((s,u)=>{let l=`collectionJoin${u}`,I=c[l]?.userErrors??[];if(I.length===0)return;let T=I.map(v=>v.message?.trim()).filter(Boolean).join("; ");P.push(`${s}: ${T||"Shopify rejected this collection assignment."}`)}),{product:{id:A(d.id),adminGraphqlApiId:d.id,title:d.title,status:d.status},collectionFailures:P}}async function k(t){try{let e=x(t,"shopify","INVALID_SHOPIFY_REQUEST_BODY");if(!e.request)return h(400,m("shopify",new Error("request is required"),"MISSING_PRODUCT_SET_REQUEST"));let r=await R(e.request,e.collectionIds??[]);return U("Upserted Shopify product with collections",{productId:r.product.id,collectionFailures:r.collectionFailures.length}),b(r)}catch(e){return C("Failed to upsert Shopify product with collections",e),h(w(e),m("shopify",e,"SHOPIFY_UPSERT_PRODUCT_WITH_COLLECTIONS_FAILED"))}}0&&(module.exports={handler});
