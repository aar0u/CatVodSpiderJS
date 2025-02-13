export class Vod {
  typeName?: string;
  vodId?: string;
  vodName?: string;
  vodPic?: string;
  vodRemarks?: string;
  vodYear?: string;
  vodArea?: string;
  vodActor?: string;
  vodDirector?: string;
  vodContent?: string;
  vodPlayFrom?: string;
  vodPlayUrl?: string;
  vodTag?: string;
  action?: string;

  constructor(init?: Partial<Vod>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  toJSON() {
    return toSnakeCase({ ...this } as Record<string, unknown>);
  }
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const snakeKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      result[snakeKey] = obj[key];
    }
  }
  return result;
}
