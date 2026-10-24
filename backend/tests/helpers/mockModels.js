function createFindChain(resolvedValue = []) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockResolvedValue(resolvedValue),
  };
  return chain;
}

function createMockModels({ items = [], sellers = [] } = {}) {
  const User = {
    find: jest.fn(() => ({
      select: jest.fn().mockResolvedValue(sellers),
    })),
    findById: jest.fn(),
  };

  const Item = {
    find: jest.fn(() => createFindChain(items)),
    countDocuments: jest.fn().mockResolvedValue(items.length),
    findById: jest.fn(),
  };

  return {
    User,
    Cart: {},
    Address: {},
    Order: {},
    SellerRequest: {},
    Item,
    OTP: {},
    CancellationRequest: {},
  };
}

module.exports = { createMockModels, createFindChain };
