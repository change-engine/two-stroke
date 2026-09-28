export interface paths {
  "/doc": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description Invalid Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
              issues: {
                /** @enum {string} */
                code: "invalid_literal";
                expected: string;
                received: string;
                path: string[];
                message: string;
              }[];
            };
          };
        };
        /** @description Invalid Request */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/hello/{name}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          name: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              hello: string;
            };
          };
        };
        /** @description Invalid Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
              issues: {
                /** @enum {string} */
                code: "invalid_literal";
                expected: string;
                received: string;
                path: string[];
                message: string;
              }[];
            };
          };
        };
        /** @description Invalid Request */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/echo": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            message: string;
          };
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              message: string;
            };
          };
        };
        /** @description Invalid Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
              issues: {
                /** @enum {string} */
                code: "invalid_literal";
                expected: string;
                received: string;
                path: string[];
                message: string;
              }[];
            };
          };
        };
        /** @description Invalid Request */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/pbkdf": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              ok: boolean;
            };
          };
        };
        /** @description Invalid Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
              issues: {
                /** @enum {string} */
                code: "invalid_literal";
                expected: string;
                received: string;
                path: string[];
                message: string;
              }[];
            };
          };
        };
        /** @description Invalid Request */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/jwt": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              sub: string;
            };
          };
        };
        /** @description Invalid Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
              issues: {
                /** @enum {string} */
                code: "invalid_literal";
                expected: string;
                received: string;
                path: string[];
                message: string;
              }[];
            };
          };
        };
        /** @description Invalid Request */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/error": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": Record<string, never>;
          };
        };
        /** @description Invalid Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
              issues: {
                /** @enum {string} */
                code: "invalid_literal";
                expected: string;
                received: string;
                path: string[];
                message: string;
              }[];
            };
          };
        };
        /** @description Invalid Request */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              error: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type operations = Record<string, never>;
