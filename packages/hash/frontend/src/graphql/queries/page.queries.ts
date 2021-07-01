import { gql } from "@apollo/client";

const pageFieldsFragment = gql`
  fragment PageFields on Page {
    __typename
    id
    namespaceId
    properties {
      __typename
      archived
      summary
      title
      contents {
        id
        properties {
          componentId
          entityType
          entity {
            __typename
            id
            type
            ... on UnknownEntity {
              unknownProperties: properties
            }
            ... on Text {
              textProperties: properties {
                texts {
                  text
                  bold
                  underline
                  italics
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const getPageQuery = gql`
  query getPage($pageId: ID!) {
    page(id: $pageId) {
      ...PageFields
    }
  }
  ${pageFieldsFragment}
`;

export const createPage = gql`
  mutation createPage(
    $namespaceId: ID!
    $properties: PageCreationData!
  ) {
    createPage(
      namespaceId: $namespaceId
      properties: $properties
    ) {
      ...PageFields
    }
  }
  ${pageFieldsFragment}
`;

export const updatePage = gql`
  mutation updatePage($id: ID!, $properties: PageUpdateData!) {
    updatePage(id: $id, properties: $properties) {
      ...PageFields
    }
  }
  ${pageFieldsFragment}
`;

export const insertBlockIntoPage = gql`
  mutation insertBlockIntoPage(
    $componentId: ID!
    $entityType: String!
    $entityProperties: JSONObject!
    $position: Int!
    $pageId: ID!
  ) {
    insertBlockIntoPage(
      componentId: $componentId
      entityType: $entityType
      entityProperties: $entityProperties
      position: $position
      pageId: $pageId
    ) {
      ...PageFields
    }
  }
  ${pageFieldsFragment}
`;
