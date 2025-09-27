'use client'
import React,{ useState } from 'react';
import { FileUploaderRegular } from '@uploadcare/react-uploader';
import "@uploadcare/react-uploader/core.css";
import { useRouter } from 'next/navigation';

const pubKey = "23cab9f36c8d0ed15784";
type Props = {
  onUpload?:any
}
export default function UploadCareButton({ onUpload }:Props){
    const router = useRouter();
    const handleUpload = async (e:any)=>{
        try{
        const file:string = e.allEntries[0].cdnUrl;
        console.log(file);
        const response = await onUpload(file);
        console.log(response);
        if(file){
            router.refresh();
        }
        }catch(err){
            console.log(err);
        }
    }
    const handleUploadFailed = async (e:any) => {
        console.log(e.errors[0]);
    };
  return (
    <div>
      <FileUploaderRegular pubkey={pubKey} onChange={handleUpload} onFileUploadFailed={handleUploadFailed}/>
    </div>
  )
}