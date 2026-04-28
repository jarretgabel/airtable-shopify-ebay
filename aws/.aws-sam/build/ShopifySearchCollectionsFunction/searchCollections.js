"use strict";var a=Object.defineProperty;var x=Object.getOwnPropertyDescriptor;var A=Object.getOwnPropertyNames;var $=Object.prototype.hasOwnProperty;var C=(e,t,r)=>t in e?a(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var v=(e,t)=>{for(var r in t)a(e,r,{get:t[r],enumerable:!0})},R=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of A(t))!$.call(e,o)&&o!==r&&a(e,o,{get:()=>t[o],enumerable:!(i=x(t,o))||i.enumerable});return e};var U=e=>R(a({},"__esModule",{value:!0}),e);var s=(e,t,r)=>C(e,typeof t!="symbol"?t+"":t,r);var _={};v(_,{handler:()=>G});module.exports=U(_);var n=class extends Error{constructor(r,i,o){super(i);s(this,"statusCode");s(this,"service");s(this,"code");s(this,"retryable");this.name="HttpError",this.statusCode=r,this.service=o.service,this.code=o.code,this.retryable=o.retryable??!1}};function p(e,t,r){return t instanceof n?{message:t.message,service:t.service||e,code:t.code||r,retryable:t.retryable}:{message:t instanceof Error?t.message:"Unexpected error",service:e,code:r,retryable:!0}}function f(e,t=500){return e instanceof n?e.statusCode:t}var g={"access-control-allow-origin":"*","access-control-allow-headers":"content-type,authorization","content-type":"application/json"};function y(e){return{statusCode:200,headers:g,body:JSON.stringify(e)}}function m(e,t){return{statusCode:e,headers:g,body:JSON.stringify(t)}}function c(e,t){let r=e.queryStringParameters?.[t]?.trim();return r||void 0}function h(e,t,r){let i=c(e,t);if(!i)return r.defaultValue;let o=Number(i);if(!Number.isInteger(o)||o<r.min)throw new n(400,`${t} must be an integer >= ${r.min}`,{service:r.service,code:r.code,retryable:!1});return Math.min(o,r.max)}function T(e){return e instanceof Error?{name:e.name,message:e.message,stack:e.stack}:{value:String(e)}}function S(e,t={}){console.info(JSON.stringify({level:"info",message:e,...t}))}function P(e,t,r={}){console.error(JSON.stringify({level:"error",message:e,error:T(t),...r}))}function d(e){let t=process.env[e]?.trim();if(!t)throw new Error(`Missing required environment variable: ${e}`);return t}async function I(e,t){let r=d("SHOPIFY_STORE_DOMAIN"),i=d("SHOPIFY_ACCESS_TOKEN"),o=await fetch(`https://${r}/admin/api/2024-04/graphql.json`,{method:"POST",headers:{"X-Shopify-Access-Token":i,"Content-Type":"application/json"},body:JSON.stringify({query:e,variables:t})}),u=await o.json().catch(()=>({}));if(!o.ok)throw new n(o.status,"Shopify GraphQL request failed.",{service:"shopify",code:"SHOPIFY_GRAPHQL_HTTP_ERROR",retryable:o.status>=500});let l=u.errors??[];if(l.length>0){let E=l.map(b=>b.message?.trim()).filter(Boolean).join("; ");throw new n(502,E||"Shopify GraphQL request failed.",{service:"shopify",code:"SHOPIFY_GRAPHQL_ERROR",retryable:!1})}if(!u.data)throw new n(502,"Shopify GraphQL request returned no data.",{service:"shopify",code:"SHOPIFY_GRAPHQL_EMPTY_DATA",retryable:!1});return u.data}async function O(e=250){return(await I(`query GetCollections($first: Int!) {
      collections(first: $first, query: "collection_type:custom", sortKey: TITLE) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }`,{first:e})).collections.edges.map(r=>r.node)}async function w(e,t=250){let r=e.trim();return r?(await I(`query SearchCollections($query: String!, $first: Int!) {
      collections(first: $first, query: $query, sortKey: TITLE) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }`,{query:`collection_type:custom ${r}`.trim(),first:t})).collections.edges.map(o=>o.node):O(t)}async function G(e){try{let t=c(e,"search")??"",r=h(e,"first",{defaultValue:250,min:1,max:250,service:"shopify",code:"INVALID_FIRST"}),i=await w(t,r);return S("Searched Shopify collections",{count:i.length,first:r,hasSearch:t.length>0}),y(i)}catch(t){return P("Failed to search Shopify collections",t),m(f(t),p("shopify",t,"SHOPIFY_SEARCH_COLLECTIONS_FAILED"))}}0&&(module.exports={handler});
