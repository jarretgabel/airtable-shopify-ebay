"use strict";var f=Object.defineProperty;var C=Object.getOwnPropertyDescriptor;var v=Object.getOwnPropertyNames;var R=Object.prototype.hasOwnProperty;var T=(e,t,r)=>t in e?f(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var O=(e,t)=>{for(var r in t)f(e,r,{get:t[r],enumerable:!0})},_=(e,t,r,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of v(t))!R.call(e,i)&&i!==r&&f(e,i,{get:()=>t[i],enumerable:!(o=C(t,i))||o.enumerable});return e};var G=e=>_(f({},"__esModule",{value:!0}),e);var c=(e,t,r)=>T(e,typeof t!="symbol"?t+"":t,r);var j={};O(j,{handler:()=>q});module.exports=G(j);var n=class extends Error{constructor(r,o,i){super(o);c(this,"statusCode");c(this,"service");c(this,"code");c(this,"retryable");this.name="HttpError",this.statusCode=r,this.service=i.service,this.code=i.code,this.retryable=i.retryable??!1}};function g(e,t,r){return t instanceof n?{message:t.message,service:t.service||e,code:t.code||r,retryable:t.retryable}:{message:t instanceof Error?t.message:"Unexpected error",service:e,code:r,retryable:!0}}function I(e,t=500){return e instanceof n?e.statusCode:t}var w={"access-control-allow-origin":"*","access-control-allow-headers":"content-type,authorization","content-type":"application/json"};function E(e){return{statusCode:200,headers:w,body:JSON.stringify(e)}}function m(e,t){return{statusCode:e,headers:w,body:JSON.stringify(t)}}function b(e,t,r){if(!e.body)throw new n(400,"Request body is required",{service:t,code:r,retryable:!1});let o=e.isBase64Encoded?Buffer.from(e.body,"base64").toString("utf8"):e.body;try{return JSON.parse(o)}catch{throw new n(400,"Request body must be valid JSON",{service:t,code:r,retryable:!1})}}function D(e){return e instanceof Error?{name:e.name,message:e.message,stack:e.stack}:{value:String(e)}}function x(e,t={}){console.info(JSON.stringify({level:"info",message:e,...t}))}function A(e,t,r={}){console.error(JSON.stringify({level:"error",message:e,error:D(t),...r}))}function y(e){let t=process.env[e]?.trim();if(!t)throw new Error(`Missing required environment variable: ${e}`);return t}async function $(e,t){let r=y("SHOPIFY_STORE_DOMAIN"),o=y("SHOPIFY_ACCESS_TOKEN"),i=await fetch(`https://${r}/admin/api/2024-04/graphql.json`,{method:"POST",headers:{"X-Shopify-Access-Token":o,"Content-Type":"application/json"},body:JSON.stringify({query:e,variables:t})}),a=await i.json().catch(()=>({}));if(!i.ok)throw new n(i.status,"Shopify GraphQL request failed.",{service:"shopify",code:"SHOPIFY_GRAPHQL_HTTP_ERROR",retryable:i.status>=500});let s=a.errors??[];if(s.length>0){let d=s.map(l=>l.message?.trim()).filter(Boolean).join("; ");throw new n(502,d||"Shopify GraphQL request failed.",{service:"shopify",code:"SHOPIFY_GRAPHQL_ERROR",retryable:!1})}if(!a.data)throw new n(502,"Shopify GraphQL request returned no data.",{service:"shopify",code:"SHOPIFY_GRAPHQL_EMPTY_DATA",retryable:!1});return a.data}async function U(e,t,r,o){let i=await $(`mutation CreateStagedImageUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,{input:[{filename:e,mimeType:t,resource:"IMAGE",httpMethod:"POST",fileSize:String(Buffer.from(r,"base64").byteLength)}]}),a=i.stagedUploadsCreate.userErrors??[];if(a.length>0)throw new Error(a.map(u=>u.message.trim()).filter(Boolean).join("; ")||"Shopify staged upload failed.");let s=i.stagedUploadsCreate.stagedTargets[0];if(!s?.url||!s.resourceUrl)throw new Error("Shopify did not return a staged upload target.");let d=new FormData;s.parameters.forEach(u=>{d.append(u.name,u.value)}),d.append("file",new Blob([Buffer.from(r,"base64")],{type:t||"image/jpeg"}),e);let l=await fetch(s.url,{method:"POST",body:d});if(!l.ok)throw new Error(`Shopify staged binary upload failed (${l.status}).`);let h=await $(`mutation CreateShopifyImageFile($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage {
            id
            fileStatus
            image {
              url
            }
            preview {
              image {
                url
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,{files:[{alt:o?.trim()||void 0,contentType:"IMAGE",originalSource:s.resourceUrl}]}),S=h.fileCreate.userErrors??[];if(S.length>0)throw new Error(S.map(u=>u.message.trim()).filter(Boolean).join("; ")||"Shopify rejected the uploaded image.");let p=h.fileCreate.files[0],P=p?.image?.url?.trim()||p?.preview?.image?.url?.trim()||s.resourceUrl;if(!p?.id||!P)throw new Error("Shopify uploaded the image but returned no file URL.");return{id:p.id,url:P}}async function q(e){try{let t=b(e,"shopify","INVALID_SHOPIFY_REQUEST_BODY"),r=t.filename?.trim(),o=t.mimeType?.trim()||"image/jpeg",i=t.file?.trim();if(!r||!i)return m(400,g("shopify",new Error("filename and file are required"),"INVALID_IMAGE_UPLOAD_PAYLOAD"));let a=await U(r,o,i,t.alt);return x("Uploaded Shopify image",{filename:r}),E(a)}catch(t){return A("Failed to upload Shopify image",t),m(I(t),g("shopify",t,"SHOPIFY_UPLOAD_IMAGE_FAILED"))}}0&&(module.exports={handler});
