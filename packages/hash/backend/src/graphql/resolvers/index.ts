import GraphQLJSON from "graphql-type-json";

import { Entity } from "../autoGeneratedTypes";
// import { entityAccountName } from "./shared/account";
import {
  aggregateEntity,
  createEntity,
  entity,
  entityFields,
  updateEntity,
} from "./entity";
import { blockFields } from "./block";
import {
  createPage,
  insertBlockIntoPage,
  accountPages,
  page,
  pageFields,
  updatePage,
} from "./pages";
import { accounts } from "./account/accounts";
import { createUser } from "./shared/createUser";
import { createOrg } from "./shared/createOrg";
import { sendLoginCode } from "./user/sendLoginCode";
import { loginWithLoginCode } from "./user/loginWithLoginCode";

import { DbOrg, DbUser } from "../../types/dbTypes";
import { GraphQLContext } from "../context";
import { ForbiddenError } from "apollo-server-express";
import { logout } from "./user/logout";
import { me } from "./user/me";

const KNOWN_ENTITIES = ["Page", "Text", "User"];

const loggedIn =
  (next: any) => (obj: any, args: any, ctx: GraphQLContext, info: any) => {
    if (!ctx.user)
      throw new ForbiddenError("You must be logged in to perform this action.");
    return next(obj, args, ctx, info);
  };

export const resolvers = {
  Query: {
    accountPages,
    accounts,
    aggregateEntity,
    entity,
    page,
    me: loggedIn(me),
  },

  Mutation: {
    createEntity,
    createPage,
    insertBlockIntoPage,
    updateEntity,
    updatePage,
    createUser,
    createOrg,
    sendLoginCode,
    loginWithLoginCode,
    logout: loggedIn(logout),
  },

  JSONObject: GraphQLJSON,

  BlockProperties: {
    entity: blockFields.entity,
  },

  PageProperties: {
    contents: pageFields.contents,
  },

  UnknownEntity: {
    properties: entityFields.properties,
  },

  Entity: {
    __resolveType(entity: Entity) {
      if (KNOWN_ENTITIES.includes(entity.type)) {
        return entity.type;
      }
      return "UnknownEntity";
    },
    history: entityFields.history,
  },

  Account: {
    __resolveType(entity: DbUser | DbOrg) {
      return entity.type;
    },
  },
};
