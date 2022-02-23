const { currentObject, hasPermission } = require('../../../src/middleware/authorization');
const { recordService, storageService } = require('../../../src/services');
const { Permissions } = require('../../../src/components/constants');

const testRes = {
  writeHead: jest.fn(),
  end: jest.fn()
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('currentObject', () => {
  const recordServiceReadSpy = jest.spyOn(recordService, 'read');
  const storageServiceHeadSpy = jest.spyOn(storageService, 'headObject');

  it('does not inject any current object to request if no object id param', async () => {
    const testReq = {
      params: {
        blah: 123
      },
    };
    const nxt = jest.fn();

    await currentObject(testReq, testRes, nxt);
    expect(testReq.currentObject).toBeUndefined();
    expect(nxt).toHaveBeenCalledTimes(1);
    expect(nxt).toHaveBeenCalledWith();
  });

  it('does not inject any current object to request if object id param is blank', async () => {
    const testReq = {
      params: {
        objId: ''
      },
    };
    const nxt = jest.fn();

    await currentObject(testReq, testRes, nxt);
    expect(testReq.currentObject).toBeUndefined();
    expect(nxt).toHaveBeenCalledTimes(1);
    expect(nxt).toHaveBeenCalledWith();
  });

  it('moves on if an exception happens', async () => {
    const testReq = {
      params: {
        objId: '1234'
      },
    };
    const nxt = jest.fn();
    recordServiceReadSpy.mockImplementation(() => { throw new Error('test'); });

    await currentObject(testReq, testRes, nxt);
    expect(testReq.currentObject).toBeUndefined();
    expect(recordServiceReadSpy).toHaveBeenCalledWith('1234');
    expect(nxt).toHaveBeenCalledTimes(1);
    expect(nxt).toHaveBeenCalledWith();
  });

  it('sets the current object based on the results from the services', async () => {
    const testReq = {
      params: {
        objId: '1234'
      },
    };
    const testRecord = { a: 1 };
    const testStorage = { b: 2 };
    const nxt = jest.fn();
    recordServiceReadSpy.mockReturnValue(testRecord);
    storageServiceHeadSpy.mockReturnValue(testStorage);

    await currentObject(testReq, testRes, nxt);
    expect(testReq.currentObject).toEqual({ ...testRecord, ...testStorage });
    expect(recordServiceReadSpy).toHaveBeenCalledWith('1234');
    expect(nxt).toHaveBeenCalledTimes(1);
    expect(nxt).toHaveBeenCalledWith();
  });
});

describe('hasPermission', () => {
  it('returns a middleware function', async () => {
    const mw = hasPermission(Permissions.READ);
    expect(mw).toBeInstanceOf(Function);
  });

  it('403s if the request has no current object', async () => {
    const mw = hasPermission(Permissions.READ);
    const nxt = jest.fn();
    const req = { a: '1' };

    await mw(req, testRes, nxt);
    expect(nxt).toHaveBeenCalledTimes(0);
  });
});
