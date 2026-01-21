export class DocMetadata {
  module: string;
  title: string;
  description: string;
  path: string;
}

export class DocsListResponseDto {
  docs: DocMetadata[];
}
