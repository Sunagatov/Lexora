package com.zufar.bookshelf.service;

import com.zufar.bookshelf.dao.author.model.Author;
import com.zufar.bookshelf.dao.book.model.Book;
import com.zufar.bookshelf.dao.country.CountryRepository;
import com.zufar.bookshelf.dao.country.model.Country;
import com.zufar.bookshelf.dao.author.AuthorRepository;
import com.zufar.bookshelf.dao.book.BookRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AuthorService {

    private final AuthorRepository authorRepository;
    private final CountryRepository countryRepository;
    private final BookRepository bookRepository;

    public Author save(Long id, String fullName, String nickName, int birthYear, int birthMonth, int birthDay,
                       int deathYear, int deathMonth, int deathDay, Long countryId, List<Long> booksIds,
                       String imageLink) {
        Author author = new Author();
        if (id != null) {
            author = authorRepository.getOne(id);
        }
        LocalDate birthday = LocalDate.of(birthYear, birthMonth, birthDay);
        LocalDate deathday = LocalDate.of(deathYear, deathMonth, deathDay);
        Country country = countryRepository.findById(countryId).get();
        author.setFullName(fullName);
        author.setNickName(nickName);
        author.setBirthday(birthday);
        author.setImageLink(imageLink);
        author.setDeathDay(deathday);
        if (booksIds != null) {
            List<Book> books = bookRepository.findAllById(booksIds);
            author.setBooks(books);
            for (Book book : books) {
                book.getAuthors().add(author);
                bookRepository.save(book);
            }
        }
        author.setCountry(country);

        Author savedAuthor = authorRepository.save(author);

        log.info("Updating {} was successful", savedAuthor);
        return savedAuthor;
    }

}