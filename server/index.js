import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { PubSub } from "graphql-subscriptions";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import express from "express";
import http from "http";
import cors from "cors";

const pubsub = new PubSub();
const questions = [];

const typeDefs = `#graphql
  type Option { id: ID!, title: String!, votes: Int! }
  type Question { id: ID!, title: String!, options: [Option!]! }
  type Query { questions: [Question!]!, question(id: ID!): Question }
  type Mutation { createQuestion(title: String!, options: [String!]!): Question, vote(optionId: ID!): Question }
  type Subscription { questionCreated: Question, voteUpdated: Question }
`;

const resolvers = {
  Query: {
    questions: () => questions,
    question: (_, { id }) => questions.find((q) => q.id === id),
  },
  Mutation: {
    createQuestion: (_, { title, options }) => {
      const newQuestion = {
        id: Math.random().toString(36).substring(2, 9),
        title,
        options: options.map((opt) => ({
          id: Math.random().toString(36).substring(2, 9),
          title: opt,
          votes: 0,
        })),
      };
      questions.unshift(newQuestion);
      pubsub.publish("QUESTION_CREATED", { questionCreated: newQuestion });
      return newQuestion;
    },
    vote: (_, { optionId }) => {
      const question = questions.find((q) =>
        q.options.some((opt) => opt.id === optionId)
      );
      if (!question) throw new Error("Seçenek bulunamadı.");
      const option = question.options.find((opt) => opt.id === optionId);
      option.votes += 1;
      pubsub.publish("VOTE_UPDATED", { voteUpdated: question });
      return question;
    },
  },
  Subscription: {
    questionCreated: {
      subscribe: () => pubsub.asyncIterator(["QUESTION_CREATED"]),
    },
    voteUpdated: { subscribe: () => pubsub.asyncIterator(["VOTE_UPDATED"]) },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });
const app = express();
const httpServer = http.createServer(app);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();
app.use("/graphql", cors(), express.json(), expressMiddleware(server));

const PORT = 4000;
httpServer.listen(PORT);
