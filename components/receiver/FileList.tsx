import { FileCard } from "./FileCard";
import { FileMetadata } from "@/app/receiver/page";

interface FileListProps {
  files: FileMetadata[];
  endpoint: string;
  shareID: string;
}

export function FileList({ files, endpoint, shareID }: FileListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {files.map((file, index) => (
        <FileCard
          key={file.upload_id}
          file={file}
          endpoint={endpoint}
          shareID={shareID}
          animationDelay={index * 50}
        />
      ))}
    </div>
  );
}
