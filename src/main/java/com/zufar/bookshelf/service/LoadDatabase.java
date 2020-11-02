package com.zufar.bookshelf.service;

import com.zufar.bookshelf.dao.author.AuthorRepository;
import com.zufar.bookshelf.dao.author.model.Author;
import com.zufar.bookshelf.dao.book.BookRepository;
import com.zufar.bookshelf.dao.book.model.Book;
import com.zufar.bookshelf.dao.country.CountryRepository;
import com.zufar.bookshelf.dao.country.model.Country;
import com.zufar.bookshelf.dao.user.RoleRepository;
import com.zufar.bookshelf.dao.user.UserRepository;
import com.zufar.bookshelf.dao.user.model.Gender;
import com.zufar.bookshelf.dao.user.model.Role;
import com.zufar.bookshelf.dao.user.model.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Slf4j
@Configuration
class LoadDatabase {

    @Bean
    CommandLineRunner initDatabase(AuthorRepository authorRepository,
                                   BookRepository bookRepository,
                                   CountryRepository countryRepository,
                                   RoleRepository roleRepository,
                                   UserRepository userRepository) {
        return args -> {

            Role role_admin = new Role(1L, "ROLE_ADMIN");
            Role role_user = new Role(2L, "ROLE_USER");

            roleRepository.save(role_admin);
            roleRepository.save(role_user);

            Country russian_federation = new Country("Russian Federation");

            User user = new User()
                    .setCountry(russian_federation)
                    .setNickName("Admin")
                    .setPassword("Admin")
                    .setGender(Gender.MALE)
                    .setLogin("Admin")
                    .setFullName("Admin")
                    .setRoles(Set.of(role_admin))
                    .setBirthday(LocalDate.of(1903, 6, 25));

            user.addRole(role_admin);
            userRepository.save(user);

            countryRepository.save(russian_federation);
            countryRepository.save(new Country("British India"));
            countryRepository.save(new Country("USA"));

            Author orwel = authorRepository.save(
                    new Author()
                            .setFullName("Eric Blair Arthur")
                            .setNickName("George Orwell")
                            .setBirthday(LocalDate.of(1903, 6, 25))
                            .setDeathDay(LocalDate.of(1903, 6, 25))
                            .setCountry(russian_federation)
                            .setImageLink("https://mtdata.ru/u19/photoA884/20446828934-0/original.jpg")
            );

            Author bradbury = authorRepository.save(
                    new Author()
                            .setFullName("Ray Bradbury")
                            .setNickName("авпрврвр варврварв")
                            .setBirthday(LocalDate.of(1903, 6, 25))
                            .setDeathDay(LocalDate.of(1903, 6, 25))
                            .setCountry(russian_federation)
                            .setImageLink("https://mtdata.ru/u19/photoA884/20446828934-0/original.jpg")
            );

            Book book_1984 = bookRepository.save(
                    new Book()
                            .setTitle("Nineteen Eighty-Four")
                            .setAuthors(List.of(bradbury))
                            .setEpubLink("https://avidreaders.ru/download/1984.html?f=epub")
                            .setPageCount(456)
                            .setCountry(russian_federation)
                            .setPublicationDate(LocalDate.of(1903, 6, 25))
                            .setImageLink("https://mtdata.ru/u19/photoA884/20446828934-0/original.jpg")
            );
            Book book_2 = bookRepository.save(
                    new Book()
                            .setTitle("dsgfsgsgsgsg")
                            .setAuthors(List.of(orwel))
                            .setEpubLink("https://avidreaders.ru/download/1984.html?f=epub")
                            .setPageCount(456)
                            .setCountry(russian_federation)
                            .setPublicationDate(LocalDate.of(1903, 6, 25))
            );

        };
    }
}