'use strict'

const chai = require('chai')
const Serverless = require('serverless/lib/Serverless')
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider')
const ServerlessApigatewayServiceProxy = require('./../index')

chai.use(require('chai-as-promised'))
const expect = require('chai').expect

describe('#validateServiceProxies()', () => {
  let serverless
  let serverlessApigatewayServiceProxy

  beforeEach(() => {
    serverless = new Serverless()
    serverless.servicePath = true
    serverless.service.service = 'apigw-service-proxy'
    const options = {
      stage: 'dev',
      region: 'us-east-1'
    }
    serverless.setProvider('aws', new AwsProvider(serverless))
    serverlessApigatewayServiceProxy = new ServerlessApigatewayServiceProxy(serverless, options)
  })

  describe('common properties', () => {
    it('should throw if an invalid proxy type is given', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            xxxxx: {
              path: '/kinesis',
              method: 'post',
              streamName: 'streamName'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'Invalid APIG proxy "xxxxx". This plugin supported Proxies are: kinesis, sqs, s3, sns.'
      )
    })

    it('should throw an error if http proxy type is not an object', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: 'xxxx'
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because ["kinesis" must be an object]'
      )
    })

    it('should throw if "path" property is missing', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              method: 'post',
              streamName: 'streamName'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "path" fails because ["path" is required]]'
      )
    })

    it('should throw if "method" property is missing', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "method" fails because ["method" is required]]'
      )
    })

    it('should throw if "method" property is set to unsupported method', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              method: 'xxxx',
              streamName: 'streamName'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "method" fails because ["method" must be one of [get, post, put, patch, options, head, delete, any]]]'
      )
    })

    it('should allow case insensitive usage of method property', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              method: 'post',
              streamName: 'streamName'
            }
          },
          {
            sqs: {
              path: '/sqs',
              method: 'POST',
              queueName: 'queueName'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should process cors defaults', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              method: 'post',
              streamName: 'streamName',
              cors: true
            }
          }
        ]
      }

      const json = serverlessApigatewayServiceProxy.validateServiceProxies()

      expect(json).to.deep.equal({
        events: [
          {
            serviceName: 'kinesis',
            http: {
              path: 'kinesis',
              streamName: 'streamName',
              auth: {
                authorizationType: 'NONE'
              },
              method: 'post',
              cors: {
                origins: ['*'],
                origin: '*',
                methods: ['OPTIONS', 'POST'],
                headers: [
                  'Content-Type',
                  'X-Amz-Date',
                  'Authorization',
                  'X-Api-Key',
                  'X-Amz-Security-Token',
                  'X-Amz-User-Agent'
                ],
                allowCredentials: false
              }
            }
          }
        ],
        corsPreflight: {
          kinesis: {
            headers: [
              'Content-Type',
              'X-Amz-Date',
              'Authorization',
              'X-Api-Key',
              'X-Amz-Security-Token',
              'X-Amz-User-Agent'
            ],
            methods: ['OPTIONS', 'POST'],
            origins: ['*'],
            origin: '*',
            allowCredentials: false
          }
        }
      })
    })

    it('should throw if cors headers are not an array', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              method: 'post',
              streamName: 'streamName',
              cors: {
                headers: true
              }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "cors" fails because ["cors" must be a boolean, child "headers" fails because ["headers" must be an array]]]'
      )
    })

    it('should throw if both cors origin and origins properties are set', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              method: 'post',
              streamName: 'streamName',
              cors: {
                origins: ['acme.com'],
                origin: '*'
              }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "cors" fails because ["cors" must be a boolean, "cors" can have "origin" or "origins" but not both]]'
      )
    })

    it('should process cors options', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              method: 'post',
              streamName: 'streamName',
              cors: {
                headers: ['X-Foo-Bar'],
                origins: ['acme.com'],
                methods: ['POST', 'OPTIONS'],
                maxAge: 86400,
                cacheControl: 'max-age=600, s-maxage=600, proxy-revalidate'
              }
            }
          }
        ]
      }

      const json = serverlessApigatewayServiceProxy.validateServiceProxies()

      expect(json).to.deep.equal({
        events: [
          {
            serviceName: 'kinesis',
            http: {
              path: 'kinesis',
              method: 'post',
              streamName: 'streamName',
              auth: {
                authorizationType: 'NONE'
              },
              cors: {
                headers: ['X-Foo-Bar'],
                origins: ['acme.com'],
                methods: ['POST', 'OPTIONS'],
                maxAge: 86400,
                cacheControl: 'max-age=600, s-maxage=600, proxy-revalidate',
                allowCredentials: false
              }
            }
          }
        ],
        corsPreflight: {
          kinesis: {
            cacheControl: 'max-age=600, s-maxage=600, proxy-revalidate',
            headers: ['X-Foo-Bar'],
            methods: ['POST', 'OPTIONS'],
            origins: ['acme.com'],
            origin: '*',
            allowCredentials: false,
            maxAge: 86400
          }
        }
      })
    })

    it('should merge all preflight cors options for a path', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/users',
              method: 'get',
              streamName: 'streamName',
              cors: {
                origins: ['http://example.com'],
                allowCredentials: true,
                maxAge: 10000,
                cacheControl: 'max-age=600, s-maxage=600, proxy-revalidate'
              }
            }
          },
          {
            kinesis: {
              method: 'POST',
              path: 'users',
              streamName: 'streamName',
              cors: {
                origins: ['http://example2.com'],
                maxAge: 86400
              }
            }
          },
          {
            kinesis: {
              method: 'PUT',
              path: 'users/{id}',
              streamName: 'streamName',
              cors: {
                headers: ['TestHeader']
              }
            }
          },
          {
            kinesis: {
              method: 'DELETE',
              path: 'users/{id}',
              streamName: 'streamName',
              cors: {
                headers: ['TestHeader2']
              }
            }
          }
        ]
      }

      const json = serverlessApigatewayServiceProxy.validateServiceProxies()

      expect(json.corsPreflight['users/{id}'].methods).to.deep.equal(['OPTIONS', 'DELETE', 'PUT'])
      expect(json.corsPreflight.users.origins).to.deep.equal([
        'http://example2.com',
        'http://example.com'
      ])
      expect(json.corsPreflight['users/{id}'].headers).to.deep.equal(['TestHeader2', 'TestHeader'])
      expect(json.corsPreflight.users.maxAge).to.equal(86400)
      expect(json.corsPreflight.users.cacheControl).to.equal(
        'max-age=600, s-maxage=600, proxy-revalidate'
      )
      expect(json.corsPreflight.users.allowCredentials).to.equal(true)
      expect(json.corsPreflight['users/{id}'].allowCredentials).to.equal(false)
    })

    it('should throw an error if the maxAge is not a positive integer', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              method: 'POST',
              path: '/foo/bar',
              streamName: 'streamName',
              cors: {
                origin: '*',
                maxAge: -1
              }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "cors" fails because ["cors" must be a boolean, child "maxAge" fails because ["maxAge" must be larger than or equal to 1]]]'
      )
    })

    it('should handle explicit methods', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              method: 'POST',
              path: '/foo/bar',
              streamName: 'streamName',
              cors: {
                methods: ['POST']
              }
            }
          }
        ]
      }

      const json = serverlessApigatewayServiceProxy.validateServiceProxies()

      expect(json.events[0].http.cors.methods).to.deep.equal(['POST', 'OPTIONS'])
    })

    it('should throw if "authorizationType" is not a string', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              authorizationType: [],
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "authorizationType" fails because ["authorizationType" must be a string]]'
      )
    })

    it('should throw if "authorizationType" is set to an unsupported string', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              authorizationType: 'AUTH_TYPE',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "authorizationType" fails because ["authorizationType" must be one of [NONE, AWS_IAM, CUSTOM, COGNITO_USER_POOLS]]]'
      )
    })

    it('should throw if "authorizationType" is not set to "CUSTOM" when the "authorizerId" property is set', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              authorizationType: 'NONE',
              authorizerId: { Ref: 'SomeAuthorizerId' },
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "authorizationType" fails because ["authorizationType" must be one of [CUSTOM]]]'
      )
    })

    it('should throw if "authorizationScopes" is not an array', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              authorizationScopes: '',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "authorizationScopes" fails because ["authorizationScopes" must be an array]]'
      )
    })

    it('should throw if "authorizationType" is not set to "COGNITO_USER_POOLS" when the "authorizationScopes" property is set', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              authorizationType: 'NONE',
              authorizationScopes: ['editor', 'owner'],
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "authorizationType" fails because ["authorizationType" must be one of [COGNITO_USER_POOLS]]]'
      )
    })

    it('should default to "NONE" authorization type when authorizationType not set', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              method: 'post'
            }
          }
        ]
      }

      const json = serverlessApigatewayServiceProxy.validateServiceProxies()

      expect(json.events[0].http.auth).to.deep.equal({ authorizationType: 'NONE' })
    })

    it('should process "CUSTOM" authorizationType', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              authorizationType: 'CUSTOM',
              authorizerId: { Ref: 'SomeAuthorizerId' },
              method: 'post'
            }
          }
        ]
      }

      const json = serverlessApigatewayServiceProxy.validateServiceProxies()

      expect(json.events[0].http.auth).to.deep.equal({
        authorizationType: 'CUSTOM',
        authorizerId: { Ref: 'SomeAuthorizerId' }
      })
    })

    it('should process "COGNITO_USER_POOLS" authorizationType', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              streamName: 'streamName',
              authorizationType: 'COGNITO_USER_POOLS',
              authorizationScopes: ['editor', 'owner'],
              method: 'post'
            }
          }
        ]
      }

      const json = serverlessApigatewayServiceProxy.validateServiceProxies()

      expect(json.events[0].http.auth).to.deep.equal({
        authorizationType: 'COGNITO_USER_POOLS',
        authorizationScopes: ['editor', 'owner']
      })
    })

    const proxiesToTest = [
      { proxy: 'kinesis', props: { streamName: 'streamName' } },
      { proxy: 's3', props: { bucket: 'bucket', action: 'PutObject', key: 'myKey' } },
      { proxy: 'sns', props: { topicName: 'topicName' } }
    ]
    proxiesToTest.forEach(({ proxy, props }) => {
      it(`should throw if requestParameters is set for ${proxy}`, () => {
        serverlessApigatewayServiceProxy.serverless.service.custom = {
          apiGatewayServiceProxies: [
            {
              [proxy]: Object.assign(
                {
                  path: `/${proxy}`,
                  method: 'post',
                  requestParameters: { key: 'value' }
                },
                props
              )
            }
          ]
        }

        expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
          serverless.classes.Error,
          `child "${proxy}" fails because ["requestParameters" is not allowed]`
        )
      })
    })
  })

  describe('kinesis', () => {
    it('should throw if kinesis service is missing the "streamName" property', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              path: '/kinesis',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "streamName" fails because ["streamName" is required]]'
      )
    })

    it('should throw if "streamName" is not a string or an AWS intrinsic "Ref" function', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: ['xx', 'yy'],
              path: '/kinesis',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "streamName" fails because ["streamName" must be a string, "streamName" must be an object]]'
      )
    })

    it('should throw if "streamName" is set to an object that is not an AWS intrinsic Ref function', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: { xxx: 'KinesisStreamResourceId' },
              path: 'kinesis',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        'child "kinesis" fails because [child "streamName" fails because ["streamName" must be a string, child "Ref" fails because ["Ref" is required]]]'
      )
    })

    it('should not throw error if streamName is a string', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should not throw error if streamName is an AWS intrinsic Ref function', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: { Ref: 'KinesisStreamResourceId' },
              path: 'kinesis',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should not throw error if partitionKey is a string', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              partitionKey: 'partitionKey'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should not throw error if partitionKey is a pathParam', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              partitionKey: { pathParam: 'partitionKey' }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should not throw error if partitionKey is a queryStringParam', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              partitionKey: { queryStringParam: 'partitionKey' }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should not throw error if partitionKey is a bodyParam', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              partitionKey: { bodyParam: 'partitionKey' }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should throw error if partitionKey is not a string or an object', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              partitionKey: []
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "partitionKey" fails because ["partitionKey" must be a string, "partitionKey" must be an object]]'
      )
    })

    it('should throw error if partitionKey is not a valid param', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              partitionKey: { xxx: 'partitionKey' }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "partitionKey" fails because ["partitionKey" must be a string, "xxx" is not allowed, "partitionKey" must contain at least one of [pathParam, queryStringParam, bodyParam]]]'
      )
    })

    it('should throw error if request is missing the template property', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              request: { xxx: { 'application/json': 'mappingTemplate' } }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "request" fails because [child "template" fails because ["template" is required]]]'
      )
    })

    it('should throw error if request is not a mapping template object', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              request: { template: [] }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "kinesis" fails because [child "request" fails because [child "template" fails because ["template" must be an object]]]'
      )
    })

    it('should not throw error if request is a mapping template object', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            kinesis: {
              streamName: 'yourStream',
              path: 'kinesis',
              method: 'post',
              request: { template: { 'application/json': 'mappingTemplate' } }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })
  })

  describe('s3', () => {
    const getProxy = (key, value, ...missing) => {
      const proxy = {
        action: 'GetObject',
        bucket: 'myBucket',
        key: 'myKey',
        path: 's3',
        method: 'post'
      }

      if (key) {
        proxy[key] = value
      }

      missing.forEach((k) => delete proxy[k])
      return proxy
    }

    const shouldError = (message, key, value, ...missing) => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            s3: getProxy(key, value, ...missing)
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        message
      )
    }

    const shouldSucceed = (key, value) => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            s3: getProxy(key, value)
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw(
        serverless.classes.Error
      )
    }

    it('should error if the "bucket" property is missing', () => {
      shouldError(
        'child "s3" fails because [child "bucket" fails because ["bucket" is required]]',
        null,
        null,
        'bucket'
      )
    })

    it('should succeed if the "bucket" property is string or AWS Ref function', () => {
      shouldSucceed('bucket', 'x')
      shouldSucceed('bucket', { Ref: 'x' })
    })

    it('should error if the "bucket" property if AWS Ref function is invalid', () => {
      shouldError(
        'child "s3" fails because [child "bucket" fails because ["bucket" must be a string, child "Ref" fails because ["Ref" is required]]]',
        'bucket',
        { xxx: 's3Bucket' }
      )
      shouldError(
        'child "s3" fails because [child "bucket" fails because ["bucket" must be a string, child "Ref" fails because ["Ref" must be a string]]]',
        'bucket',
        { Ref: ['s3Bucket', 'Arn'] }
      )
      shouldError(
        'child "s3" fails because [child "bucket" fails because ["bucket" must be a string, "bucket" must be an object]]',
        'bucket',
        ['xx', 'yy']
      )
      shouldError(
        'child "s3" fails because [child "bucket" fails because ["bucket" must be a string, child "Ref" fails because ["Ref" is required]]]',
        'bucket',
        { 'Fn::GetAtt': ['x', 'Arn'] }
      )
    })

    it('should error if the "action" property is missing', () => {
      shouldError(
        'child "s3" fails because [child "action" fails because ["action" is required]]',
        null,
        null,
        'action'
      )
    })

    it('should error if the "action" property is not one of the allowed values', () => {
      shouldError(
        'child "s3" fails because [child "action" fails because ["action" must be a string]]',
        'action',
        ['x']
      ) // arrays
      shouldError(
        'child "s3" fails because [child "action" fails because ["action" must be a string]]',
        'action',
        { Ref: 'x' }
      ) // object
      shouldError(
        'child "s3" fails because [child "action" fails because ["action" must be one of [GetObject, PutObject, DeleteObject]]]',
        'action',
        'ListObjects'
      ) // invalid actions
    })

    it('should succeed if the "action" property is one of the allowed values', () => {
      shouldSucceed('action', 'GetObject')
      shouldSucceed('action', 'PutObject')
      shouldSucceed('action', 'DeleteObject')
    })

    it('should error the "key" property is missing', () => {
      shouldError(
        'child "s3" fails because [child "key" fails because ["key" is required]]',
        null,
        null,
        'key'
      )
    })

    it('should succeed if the "key" property is string or valid object', () => {
      shouldSucceed('key', 'myKey')
      shouldSucceed('key', { pathParam: 'myKey' })
      shouldSucceed('key', { queryStringParam: 'myKey' })
    })

    it('should error if the "key" property specifies both pathParam and queryStringParam', () => {
      shouldError(
        'child "s3" fails because [child "key" fails because ["key" must be a string, key must contain "pathParam" or "queryStringParam" but not both]]',
        'key',
        { pathParam: 'myKey', queryStringParam: 'myKey' }
      )
    })

    it('should error if the "key" property is not a string or valid object', () => {
      shouldError(
        'child "s3" fails because [child "key" fails because ["key" must be a string, "key" must be an object]]',
        'key',
        ['x']
      )
      shouldError(
        'child "s3" fails because [child "key" fails because ["key" must be a string, "param" is not allowed, "key" must contain at least one of [pathParam, queryStringParam]]]',
        'key',
        { param: 'myKey' }
      )
    })
  })

  describe('sns', () => {
    it('should throw error if the "topicName" property doesn\'t exist', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              path: 'sns',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "sns" fails because [child "topicName" fails because ["topicName" is required]]'
      )
    })

    it('should throw error if the "topicName" property is not a string or an AWS intrinsic function', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              path: 'sns',
              method: 'post',
              topicName: ['xx', 'yy']
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "sns" fails because [child "topicName" fails because ["topicName" must be a string, "topicName" must be an object]]'
      )
    })

    it('should throw error if the "topicName" property is missing the AWS intrinsic function "Fn::GetAtt"', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              path: 'sns',
              method: 'post',
              topicName: { xxx: 'SNSResourceId' }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        `child "sns" fails because [child "topicName" fails because ["topicName" must be a string, "topicName" must be in the format "{ 'Fn::GetAtt': ['<ResourceId>', 'TopicName'] }"]]`
      )
    })

    it('should throw error if the "topicName" property is an intrinsic function "Fn::GetAtt" but specifies a property other than TopicName', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              path: 'sns',
              method: 'post',
              topicName: { 'Fn::GetAtt': ['SNSResourceId', 'Arn'] }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        `child "sns" fails because [child "topicName" fails because ["topicName" must be a string, "topicName" must be in the format "{ 'Fn::GetAtt': ['<ResourceId>', 'TopicName'] }"]]`
      )
    })

    it('should not show error if topicName is valid string', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              path: 'sns',
              method: 'post',
              topicName: 'someTopicName'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should not show error if topicName is valid intrinsic function', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              path: 'sns',
              method: 'post',
              topicName: { 'Fn::GetAtt': ['SNSResourceId', 'TopicName'] }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should throw error if request is missing the template property', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              topicName: 'topicName',
              path: 'sns',
              method: 'post',
              request: { xxx: { 'application/json': 'mappingTemplate' } }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "sns" fails because [child "request" fails because [child "template" fails because ["template" is required]]]'
      )
    })

    it('should throw error if request is not a mapping template object', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              topicName: 'topicName',
              path: 'sns',
              method: 'post',
              request: { template: [] }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "sns" fails because [child "request" fails because [child "template" fails because ["template" must be an object]]]'
      )
    })

    it('should not throw error if request is a mapping template object', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sns: {
              topicName: 'topicName',
              path: 'sns',
              method: 'post',
              request: { template: { 'application/json': 'mappingTemplate' } }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })
  })

  describe('sqs', () => {
    it('should throw if sqs service is missing the "queueName" property', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sqs: {
              path: 'sqs',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "sqs" fails because [child "queueName" fails because ["queueName" is required]]'
      )
    })

    it('should throw if "queueName" is not a string or an AWS intrinsic "Fn::GetAtt" function', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sqs: {
              queueName: ['xx', 'yy'],
              path: 'sqs',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "sqs" fails because [child "queueName" fails because ["queueName" must be a string, "queueName" must be an object]]'
      )
    })

    it('should throw error if the "queueName" property is missing the AWS intrinsic function "Fn::GetAtt"', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sqs: {
              queueName: { xxx: 'sqsStreamResourceId' },
              path: 'sqs',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        `child "sqs" fails because [child "queueName" fails because ["queueName" must be a string, "queueName" must be in the format "{ 'Fn::GetAtt': ['<ResourceId>', 'QueueName'] }"]]`
      )
    })

    it('should not show error if queueName is a string', () => {
      serverlessApigatewayServiceProxy.validated = {
        events: [
          {
            serviceName: 'sqs',
            http: {
              queueName: 'yourQueue',
              path: 'sqs',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should not show error if queueName is valid intrinsic function', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sqs: {
              queueName: { 'Fn::GetAtt': ['SQSQueueResourceId', 'QueueName'] },
              path: 'sqs',
              method: 'post'
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })

    it('should throw if requestParameters is not a string to string', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sqs: {
              path: '/sqs',
              method: 'post',
              queueName: 'queueName',
              requestParameters: { key1: 'value', key2: [] }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.throw(
        serverless.classes.Error,
        'child "sqs" fails because [child "requestParameters" fails because [child "key2" fails because ["key2" must be a string]]]'
      )
    })

    it('should not throw if requestParameters is a string to string mapping', () => {
      serverlessApigatewayServiceProxy.serverless.service.custom = {
        apiGatewayServiceProxies: [
          {
            sqs: {
              path: '/sqs',
              method: 'post',
              queueName: 'queueName',
              requestParameters: { key1: 'value', key2: 'value2' }
            }
          }
        ]
      }

      expect(() => serverlessApigatewayServiceProxy.validateServiceProxies()).to.not.throw()
    })
  })
})
